import type { DeepgramModel } from '../lib/deepgramStreaming';
import { SERVER_URL } from './backend';
import { auth } from '../firebaseConfig';
import { getFirebaseAppCheckHeaders } from '../lib/firebaseAppCheck';
import { checkAiFeatureAccess } from '../lib/subscriptionUsage';
import { createSubscriptionRequiredError } from '../lib/subscriptionAccess';

export interface DeepgramConfig {
  getAccessToken: (signal?: AbortSignal) => Promise<string>;
  model: DeepgramModel;
  language: string;
}

export async function fetchDeepgramAccessToken(signal?: AbortSignal): Promise<string> {
  const user = auth.currentUser;
  if (!user?.uid) {
    throw new Error('Sign in to use voice transcription');
  }

  const decision = await checkAiFeatureAccess(user.uid, 'voiceInput');
  if (!decision.allowed) {
    throw createSubscriptionRequiredError(decision, 'voiceInput');
  }

  const firebaseIdToken = await user.getIdToken().catch(() => null);
  if (!firebaseIdToken) {
    throw new Error('Sign in to use voice transcription');
  }

  const response = await fetch(`${SERVER_URL}/deepgram/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firebaseIdToken}`,
      'Content-Type': 'application/json',
      ...await getFirebaseAppCheckHeaders(),
    },
    body: JSON.stringify({}),
    signal,
  });
  const body = await response.json().catch(() => null);
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';

  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : 'Deepgram transcription is unavailable';
    throw new Error(message);
  }
  if (!accessToken) {
    throw new Error('Deepgram transcription is unavailable');
  }

  return accessToken;
}

export function getDeepgramConfig(): DeepgramConfig {
  return {
    getAccessToken: fetchDeepgramAccessToken,
    model: 'nova-3',
    language: 'en',
  };
}

export function isDeepgramConfigured(): boolean {
  return true;
}

import { auth } from '@/firebaseConfig';
import { requireAiDataSharingConsent } from '@/lib/aiDataSharingConsent';
import { createAiAuthRequiredError } from '@/lib/aiAuth';
import { getFirebaseAppCheckHeaders } from '@/lib/firebaseAppCheck';
import { createSubscriptionRequiredError } from '@/lib/subscriptionAccess';
import { checkAiFeatureAccess, recordAiAction } from '@/lib/subscriptionUsage';
import { isUnchargedChatFeature, type AiFeatureKey } from '@/lib/subscription';

/**
 * Every server-backed AI call funnels through here, so this is where the plan
 * is applied on the client: Pro-only capabilities are refused for Free, and
 * metered ones are counted against the daily allowance.
 *
 * This keeps the UI honest, it is not a security boundary - the client can be
 * modified. The backend must verify entitlement against the Firebase UID in the
 * ID token below before doing any paid work.
 */
export const getAiRequestHeaders = async (feature: AiFeatureKey = 'aiChat') => {
  const user = auth.currentUser;
  if (!user?.uid) {
    throw createAiAuthRequiredError();
  }

  await requireAiDataSharingConsent(user.uid);

  const decision = await checkAiFeatureAccess(user.uid, feature);
  if (!decision.allowed) {
    throw createSubscriptionRequiredError(decision, feature);
  }

  const firebaseIdToken = await user.getIdToken().catch(() => null);
  if (!firebaseIdToken) {
    throw createAiAuthRequiredError();
  }

  // Counted only once the request is cleared to go out. Tool results and the
  // automatic session title finish a turn that was already charged, and voice
  // is metered by duration instead.
  if (!isUnchargedChatFeature(feature) && feature !== 'voiceInput') {
    await recordAiAction(user.uid);
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${firebaseIdToken}`,
    ...await getFirebaseAppCheckHeaders(),
  };
};

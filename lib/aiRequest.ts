import { auth } from '@/firebaseConfig';
import { requireAiDataSharingConsent } from '@/lib/aiDataSharingConsent';
import { createAiAuthRequiredError } from '@/lib/aiAuth';
import { getFirebaseAppCheckHeaders } from '@/lib/firebaseAppCheck';

export const getAiRequestHeaders = async () => {
  const user = auth.currentUser;
  if (!user?.uid) {
    throw createAiAuthRequiredError();
  }

  await requireAiDataSharingConsent(user.uid);
  const firebaseIdToken = await user.getIdToken().catch(() => null);
  if (!firebaseIdToken) {
    throw createAiAuthRequiredError();
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${firebaseIdToken}`,
    ...await getFirebaseAppCheckHeaders(),
  };
};

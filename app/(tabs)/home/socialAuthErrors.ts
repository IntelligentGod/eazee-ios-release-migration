export const ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL_MESSAGE =
  'This email already has an account. Log in with email and password first, then you can use social sign-in later.';

const getErrorCode = (error: unknown) => (
  typeof (error as { code?: unknown })?.code === 'string'
    ? String((error as { code: string }).code)
    : ''
);

export function getSocialAuthErrorMessage(error: unknown, providerLabel: string): string | null {
  const code = getErrorCode(error);

  if (code === 'SIGN_IN_CANCELLED' || code === 'ERR_REQUEST_CANCELED') {
    return null;
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL_MESSAGE;
  }

  if (code === 'auth/credential-already-in-use') {
    return `This ${providerLabel} account is already linked to another Eazee account.`;
  }

  if (code === 'auth/operation-not-allowed') {
    return `${providerLabel} sign-in is not enabled in Firebase yet.`;
  }

  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
    return 'Google Play Services is not available or needs to be updated on this device.';
  }

  return `Could not sign in with ${providerLabel}. Please try again.`;
}

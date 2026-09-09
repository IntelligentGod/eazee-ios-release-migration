import {
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL_MESSAGE,
  getSocialAuthErrorMessage,
} from '../socialAuthErrors';

describe('social auth error messages', () => {
  it('does not show an alert message when the user cancels', () => {
    expect(getSocialAuthErrorMessage({ code: 'SIGN_IN_CANCELLED' }, 'Google')).toBeNull();
    expect(getSocialAuthErrorMessage({ code: 'ERR_REQUEST_CANCELED' }, 'Apple')).toBeNull();
  });

  it('asks existing email/password users to log in first', () => {
    expect(
      getSocialAuthErrorMessage({ code: 'auth/account-exists-with-different-credential' }, 'Google')
    ).toBe(ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL_MESSAGE);
  });

  it('explains when the Firebase provider is not enabled', () => {
    expect(getSocialAuthErrorMessage({ code: 'auth/operation-not-allowed' }, 'Apple')).toBe(
      'Apple sign-in is not enabled in Firebase yet.'
    );
  });
});

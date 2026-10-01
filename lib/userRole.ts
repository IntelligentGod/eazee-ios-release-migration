import type { User } from 'firebase/auth';

/** Signing in should never hang on the role check; past this, the user is treated as a customer. */
const ROLE_CHECK_TIMEOUT_MS = 4000;

/**
 * Whether the account has the `admin: true` custom claim. The claim is set only
 * on the server (eazee-server src/scripts/setAdmin.ts), so the app never trusts
 * anything it stores itself. The token is refreshed so a newly granted role is
 * seen right away. This only decides what to show; every admin endpoint
 * checks the claim again on the server.
 */
export async function readIsAdmin(user: Pick<User, 'getIdTokenResult'> | null | undefined, forceRefresh = true) {
  if (!user) return false;
  try {
    const result = await Promise.race([
      user.getIdTokenResult(forceRefresh),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Role check timed out')), ROLE_CHECK_TIMEOUT_MS)),
    ]);
    return result.claims.admin === true;
  } catch (error) {
    console.warn('Could not check the account role:', error);
    return false;
  }
}

export type PostLoginRoute = '/role-chooser' | '/(tabs)/chat';

/** Admins choose between the admin panel and the app; customers go straight to the AI chat. */
export const getPostLoginRoute = (isAdmin: boolean): PostLoginRoute => (isAdmin ? '/role-chooser' : '/(tabs)/chat');

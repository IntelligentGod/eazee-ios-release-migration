import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { needsRoleChoice, readUserRole, type UserRole } from '@/lib/userRole';
import { useAuthSession } from './AuthSessionContext';

type RoleSessionContextValue = {
  /** null while the signed-in user's role is being read, or when signed out. */
  role: UserRole | null;
  isResolving: boolean;
  /** True for admins and the super admin until they pick a destination this launch. */
  needsRoleChoice: boolean;
  markRoleChosen: () => void;
};

const RoleSessionContext = createContext<RoleSessionContextValue | undefined>(undefined);

/**
 * Reads the role on every sign-in and every cold start with a saved session,
 * whichever screen the app opens on (email, Google or Apple sign-in, signup,
 * a deep link or a restored screen). The "chosen" flag is kept in memory only,
 * so it resets when the app is closed and reopened, and on a new sign-in.
 */
export const RoleSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: isAuthLoading } = useAuthSession();
  const uid = user?.uid ?? null;
  const [resolved, setResolved] = useState<{ uid: string; role: UserRole } | null>(null);
  const [chosenForUid, setChosenForUid] = useState<string | null>(null);

  // The role has to be fetched when the signed-in account changes; nothing else triggers it.
  useEffect(() => {
    if (!user) return;
    let isCurrent = true;
    void readUserRole(user).then((role) => {
      if (isCurrent) setResolved({ uid: user.uid, role });
    });
    return () => {
      isCurrent = false;
    };
  }, [user]);

  const markRoleChosen = useCallback(() => setChosenForUid(uid), [uid]);

  const value = useMemo<RoleSessionContextValue>(() => {
    const role = uid && resolved?.uid === uid ? resolved.role : null;
    const isResolving = isAuthLoading || (!!uid && role === null);
    return {
      role,
      isResolving,
      needsRoleChoice: needsRoleChoice(role, chosenForUid === uid),
      markRoleChosen,
    };
  }, [chosenForUid, isAuthLoading, markRoleChosen, resolved, uid]);

  return <RoleSessionContext.Provider value={value}>{children}</RoleSessionContext.Provider>;
};

export const useRoleSession = () => {
  const context = useContext(RoleSessionContext);
  if (context === undefined) {
    throw new Error('useRoleSession must be used within a RoleSessionProvider');
  }
  return context;
};

import { router } from 'expo-router';

/** The tutorial is over: start the user on a fresh chat with the starter buttons. */
export function openNewChatAfterTutorial() {
  router.push({
    pathname: '/(tabs)/chat',
    params: { chatAction: 'new', chatActionNonce: `tutorial-end-${Date.now()}` },
  });
}

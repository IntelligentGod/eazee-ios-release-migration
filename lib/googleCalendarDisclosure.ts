import { Alert, Linking } from 'react-native';
import { PRIVACY_POLICY_URL } from '@/lib/legalLinks';

export const requestGoogleCalendarDisclosure = () =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      'Google Calendar access',
      'Eazee requests access to see and edit calendars and events you choose to manage in the app. This Google permission also allows Eazee to share and permanently delete calendars you can access. If you separately allow AI features, relevant Calendar content may be sent directly to OpenAI to provide those features.',
      [
        {
          text: 'Privacy Policy',
          onPress: () => {
            void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
            resolve(false);
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue to Google', isPreferred: true, onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });

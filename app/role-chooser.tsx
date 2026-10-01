import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import OnboardingScaffold from '@/components/onboarding/OnboardingScaffold';
import { APP_BACKGROUND_COLORS, LoadingState } from '@/components/SimpleScreen';
import { isStaffRole, isSuperAdminRole } from '@/lib/userRole';
import { useAuthSession } from './context/AuthSessionContext';
import { useRoleSession } from './context/RoleSessionContext';

const CHOICE_COLORS: [string, string] = ['#67A499', '#145146'];

function ChoiceButton({
  icon,
  title,
  description,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.88} onPress={onPress} style={styles.shadow}>
      {/* Same gradient, border and shadow as the app's OnboardingButton. */}
      <LinearGradient
        colors={CHOICE_COLORS}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.card}
      >
        <View className="h-12 w-12 items-center justify-center rounded-2xl" style={styles.iconTile}>
          <MaterialCommunityIcons name={icon} size={26} color="#FFFFFF" />
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-lg font-bold text-white">{title}</Text>
          <Text className="mt-0.5 text-sm" style={styles.description}>{description}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={26} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Shown to admins and the super admin after every sign-in and app launch; customers never see it. */
export default function RoleChooserScreen() {
  const { user, isLoading: isAuthLoading } = useAuthSession();
  const { role, isResolving, markRoleChosen } = useRoleSession();

  if (!isAuthLoading && !user) return <Redirect href="/" />;
  if (isResolving) return <OnboardingScaffold backgroundColors={APP_BACKGROUND_COLORS}><LoadingState /></OnboardingScaffold>;
  if (!isStaffRole(role)) return <Redirect href="/(tabs)/chat" />;

  const open = (destination: '/admin' | '/(tabs)/chat') => {
    markRoleChosen();
    router.replace(destination);
  };

  return (
    <OnboardingScaffold backgroundColors={APP_BACKGROUND_COLORS}>
      <View className="flex-1 justify-center" style={{ gap: 16 }}>
        <Text className="text-center text-3xl font-black text-[#0B7A69]">Welcome back</Text>
        <Text className="mb-4 text-center text-sm font-semibold text-[#0B7A69]">
          {isSuperAdminRole(role) ? 'Signed in as Super Admin' : 'Signed in as Admin'}
        </Text>
        <ChoiceButton
          icon="shield-account-outline"
          title="Admin panel"
          description={isSuperAdminRole(role)
            ? 'Users and roles, purchases, income, products and limits'
            : 'Users, purchases, income, products and limits'}
          onPress={() => open('/admin')}
        />
        <ChoiceButton
          icon="chat-processing-outline"
          title="User app"
          description="Use Eazee as a customer"
          onPress={() => open('/(tabs)/chat')}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 24,
    shadowColor: '#0A4137',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#73715C',
  },
  iconTile: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  description: {
    color: 'rgba(255, 255, 255, 0.82)',
  },
});

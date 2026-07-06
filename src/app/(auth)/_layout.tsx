import { Stack } from 'expo-router';
import { colors } from '@/theme/theme';

/**
 * Auth Group Layout
 *
 * Shared layout for all authentication screens.
 * Provides consistent header styling and back navigation.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="login"
        options={{ title: '', headerTransparent: true }}
      />
      <Stack.Screen
        name="complete-profile"
        options={{ title: 'Complete Your Profile', headerBackVisible: false }}
      />
    </Stack>
  );
}

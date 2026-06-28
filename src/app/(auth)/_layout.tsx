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
        name="rider-login"
        options={{ title: 'Rider Login' }}
      />
      <Stack.Screen
        name="driver-login"
        options={{ title: 'Driver Login' }}
      />
    </Stack>
  );
}

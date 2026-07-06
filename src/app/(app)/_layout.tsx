import { Stack } from 'expo-router';
import { colors } from '@/theme/theme';

/**
 * App Group Layout (Protected)
 *
 * Route group for authenticated screens. Route protection is enforced
 * by the root layout — if the user is not authenticated, they are
 * redirected to the landing gate before this layout renders.
 */
export default function AppLayout() {
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
        name="(tabs)"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="map"
        options={{ title: 'Map', headerShown: false }}
      />
      <Stack.Screen
        name="destination"
        options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="history"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="earnings"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
    </Stack>
  );
}

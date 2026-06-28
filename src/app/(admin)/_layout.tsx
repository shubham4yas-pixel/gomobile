import { Stack } from 'expo-router';
import { colors } from '@/theme/theme';

/**
 * Admin Group Layout ("God Mode")
 *
 * Web-optimized dispatcher dashboard. Intentionally NOT behind the Firebase
 * auth gate for now (see root _layout.tsx) — reachable via direct URL: /dashboard
 */
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Dispatch' }} />
    </Stack>
  );
}

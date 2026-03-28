import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../components/app-ui';
import { AppStateProvider } from '../lib/app-state';

export default function RootLayout() {
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
    </AppStateProvider>
  );
}

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { DeviceConnectionProvider } from '@/state/deviceConnection';
import { NurseryProvider } from '@/state/nurseryController';
import { NightlightProvider } from '@/state/nightlightController';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <DeviceConnectionProvider>
      <NurseryProvider>
        <NightlightProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </NightlightProvider>
      </NurseryProvider>
    </DeviceConnectionProvider>
  );
}

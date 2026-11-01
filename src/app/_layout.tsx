import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PlaceProvider } from '../lib/PlaceContext';

export default function RootLayout() {
  return (
    <PlaceProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </PlaceProvider>
  );
}

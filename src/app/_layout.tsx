import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PlaceProvider } from '../lib/PlaceContext';

export default function RootLayout() {
  return (
    <PlaceProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1520' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="villes" options={{ animation: 'fade' }} />
        <Stack.Screen name="radar" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="vigilance" options={{ presentation: 'pageSheet', sheetGrabberVisible: true }} />
        <Stack.Screen name="detail" options={{ presentation: 'pageSheet', sheetGrabberVisible: true }} />
        <Stack.Screen name="apercu" options={{ presentation: 'pageSheet', sheetGrabberVisible: true }} />
      </Stack>
    </PlaceProvider>
  );
}

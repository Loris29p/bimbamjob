import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PlaceProvider } from '../lib/PlaceContext';
import { useOtaUpdates } from '../lib/useOtaUpdates';

export default function RootLayout() {
  useOtaUpdates();
  return (
    <PlaceProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1520' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="villes" options={{ animation: 'fade' }} />
        <Stack.Screen name="radar" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="vigilance" options={{ presentation: 'pageSheet', sheetGrabberVisible: true }} />
        <Stack.Screen name="detail" options={{ presentation: 'pageSheet', sheetGrabberVisible: true }} />
        {/* feuille ajustée à son contenu ; voile sombre sur le verre d'iOS pour que les textes blancs restent lisibles */}
        <Stack.Screen
          name="alertes"
          options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true, sheetCornerRadius: 32, contentStyle: { backgroundColor: 'rgba(16,24,38,0.62)' } }}
        />
        <Stack.Screen name="apercu" options={{ presentation: 'pageSheet', sheetGrabberVisible: true }} />
      </Stack>
    </PlaceProvider>
  );
}

import { Tabs } from 'expo-router/tabs';
import { Text } from 'react-native';
import { useTheme } from '../../lib/theme';

const icon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Météo', headerShown: false, tabBarIcon: icon('🌦️') }} />
      <Tabs.Screen name="radar" options={{ title: 'Radar', tabBarIcon: icon('🛰️') }} />
      <Tabs.Screen name="vigilance" options={{ title: 'Vigilance', tabBarIcon: icon('⚠️') }} />
      <Tabs.Screen name="villes" options={{ title: 'Villes', tabBarIcon: icon('📍') }} />
    </Tabs>
  );
}

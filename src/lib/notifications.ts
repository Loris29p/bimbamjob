import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let lastNotified = 0;

/** Prévient l'utilisateur qu'il va pleuvoir (au plus une fois toutes les 30 min). */
export async function notifyRain(placeName: string, minutes: number) {
  if (Date.now() - lastNotified < 30 * 60 * 1000) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;
    lastNotified = Date.now();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🌧️ Pluie à ${placeName}`,
        body: minutes <= 5 ? 'La pluie arrive dans quelques minutes.' : `Pluie prévue dans environ ${minutes} min.`,
      },
      trigger: null,
    });
  } catch {
    // notifications indisponibles (ex. Expo Go sur Android) : on ignore
  }
}

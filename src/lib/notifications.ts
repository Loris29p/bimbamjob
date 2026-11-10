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

async function canNotify() {
  const perm = await Notifications.getPermissionsAsync();
  return perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
}

/** Rappel programmé pour un lieu (une seule à la fois par lieu). Renvoie false si refusé. */
export async function scheduleReminder(key: string, title: string, body: string, at: number) {
  try {
    if (!(await canNotify())) return false;
    await cancelReminder(key);
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { reminder: key } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at * 1000 },
    });
    return true;
  } catch {
    return false;
  }
}

/** Heure (unix) du rappel en attente pour ce lieu, ou null. */
export async function pendingReminder(key: string) {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const n = all.find((x) => x.content.data?.reminder === key);
    const t = n?.trigger as { value?: number; date?: number } | null | undefined;
    const ms = t?.value ?? t?.date;
    return n ? (typeof ms === 'number' ? ms / 1000 : 0) : null;
  } catch {
    return null;
  }
}

export async function cancelReminder(key: string) {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((x) => x.content.data?.reminder === key).map((x) => Notifications.cancelScheduledNotificationAsync(x.identifier)));
  } catch {}
}

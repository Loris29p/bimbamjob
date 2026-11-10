import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---- Alertes « pluie dans l'heure » (vérifiées quand l'app est ouverte) ----
export type AlertPrefs = { scope: 'gps' | 'all' | 'off'; level: 'light' | 'rain' };
const PREFS_KEY = 'rain-alert-prefs';
let prefs: AlertPrefs = { scope: 'gps', level: 'light' };
let prefsLoaded = false;
const listeners = new Set<(p: AlertPrefs) => void>();

export async function getAlertPrefs(): Promise<AlertPrefs> {
  if (!prefsLoaded) {
    prefsLoaded = true;
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
    } catch {}
  }
  return prefs;
}
export function setAlertPrefs(p: AlertPrefs) {
  prefs = p;
  prefsLoaded = true;
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p)).catch(() => {});
  listeners.forEach((l) => l(p));
}
export function onAlertPrefs(l: (p: AlertPrefs) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
/** Seuil d'alerte en mm par quart d'heure : dès la bruine (0,2 mm/h) ou pluie franche (1 mm/h). */
export const alertThreshold = (p: AlertPrefs) => (p.level === 'light' ? 0.2 : 1) / 4;

/** Prévient qu'il va pleuvoir (au plus une fois toutes les 45 min par lieu, même après redémarrage). */
export async function notifyRain(key: string, placeName: string, minutes: number) {
  const storeKey = `rain-notified:${key}`;
  try {
    const last = Number((await AsyncStorage.getItem(storeKey)) ?? 0);
    if (Date.now() - last < 45 * 60 * 1000) return;
    if (!(await canNotify())) return;
    await AsyncStorage.setItem(storeKey, String(Date.now()));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🌧️ Pluie à ${placeName}`,
        body: minutes <= 5 ? 'La pluie arrive dans quelques minutes.' : `Pluie prévue dans environ ${minutes} min.`,
      },
      trigger: null,
    });
  } catch {
    // notifications indisponibles : on ignore
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

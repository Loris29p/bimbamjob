// Mises à jour à distance (EAS Update) : dès qu'une nouvelle version du code est publiée,
// l'app la télécharge et redémarre dessus — au lancement et à chaque retour au premier plan.
// Sans effet en développement (Metro) et sur le web.
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

async function checkAndApply() {
  try {
    const res = await Updates.checkForUpdateAsync();
    if (!res.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // pas de réseau ou service indisponible : on réessaiera au prochain retour dans l'app
  }
}

export function useOtaUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    checkAndApply();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkAndApply();
    });
    return () => sub.remove();
  }, []);
}

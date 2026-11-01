# Météo Pluie 🌧️

Application mobile (iOS / Android) de météo et de pluie pour la France, basée sur les modèles de **Météo-France**.

## Fonctionnalités

| Écran | Contenu | Source |
|---|---|---|
| **Météo** | Pluie dans les 2 h (pas de 15 min), conditions actuelles, heure par heure sur 36 h (température, ressenti, pluie, probabilité, vent, rafales), tendance sur 14 jours | AROME 1,3 km + ARPEGE (Météo-France) via [Open-Meteo](https://open-meteo.com), ECMWF au-delà de 4 jours |
| **Radar** | Carte animée des précipitations des 2 dernières heures | [RainViewer](https://www.rainviewer.com/api.html) |
| **Vigilance** | Vigilances officielles du département (aujourd'hui / demain), par phénomène | API officielle Météo-France |
| **Villes** | Recherche de communes, position GPS, favoris | [Base Adresse Nationale](https://adresse.data.gouv.fr) |

Une notification te prévient quand de la pluie arrive dans l'heure. Pour l'instant, la vérification se fait à l'ouverture de l'app ou quand tu la rafraîchis.

## Lancer l'app sur ton téléphone

1. Installe [Node.js](https://nodejs.org) (version 20 ou plus).
2. Installe l'app **Expo Go** sur ton téléphone (App Store / Google Play).
3. Dans le dossier du projet :
   ```bash
   npm install
   npx expo start
   ```
4. Scanne le QR code affiché avec ton téléphone : l'app s'ouvre dans Expo Go.

> Les notifications ne fonctionnent pas dans Expo Go sur Android. Il faut alors une version de développement (`npx eas-cli build --profile development`).

## Activer les vigilances Météo-France

1. Crée un compte gratuit sur https://portail-api.meteofrance.fr.
2. Abonne-toi à l'API **« Données Publiques Vigilance »** et génère une clé (API Key).
3. Copie `.env.example` en `.env` et colle ta clé :
   ```
   EXPO_PUBLIC_METEOFRANCE_API_KEY=ta_cle
   ```
4. Relance `npx expo start`.

## Publier sur les stores

Avec [EAS](https://docs.expo.dev/eas/) : `npx eas-cli build` puis `npx eas-cli submit`. Il faut un compte Apple Developer (99 €/an) et un compte Google Play Console (25 € une fois).

## Structure du code

```
src/
  app/            écrans (Expo Router)
    (tabs)/       Météo, Radar, Vigilance, Villes
  components/     cartes de l'écran Météo
  lib/            appels aux API, stockage, thème, formats
```

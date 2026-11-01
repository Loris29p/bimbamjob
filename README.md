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

## Mettre l'app sur TestFlight (Mac + Xcode)

Il faut un Mac avec Xcode et un compte Apple Developer.

**Une seule fois, au début :**
1. Sur [App Store Connect](https://appstoreconnect.apple.com) : **Apps → + → Nouvelle app**.
   - Plateforme : iOS
   - Nom : Météo Pluie (ou un autre nom libre sur l'App Store)
   - Identifiant de lot (bundle ID) : `com.loris29p.meteopluie`. S'il n'apparaît pas dans la liste, crée-le dans
     [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list), ou laisse Xcode le créer (étape 4) puis reviens ici.
   - SKU : `meteopluie`

**À chaque nouvelle version :**
1. `npm install`
2. (si tu utilises les vigilances) vérifie que le fichier `.env` contient ta clé Météo-France
3. `npm run ios:xcode` : génère le projet iOS natif (dossier `ios/`, recréé à chaque fois, ne pas le modifier à la main) et l'ouvre dans Xcode
4. Dans Xcode, clique sur **MeteoPluie** (à gauche), onglet **Signing & Capabilities** :
   coche **Automatically manage signing** et choisis ton **Team**.
5. En haut, choisis la cible **Any iOS Device (arm64)**.
6. Menu **Product → Archive**. Ça prend quelques minutes.
7. Dans la fenêtre Organizer qui s'ouvre : **Distribute App → App Store Connect → Distribute**.
8. Après 10 à 30 min de traitement, le build apparaît dans App Store Connect, onglet **TestFlight**.
   Ajoute-toi comme testeur interne et installe-le avec l'app TestFlight sur ton iPhone.

Pour envoyer une nouvelle version, augmente `version` et/ou `ios.buildNumber` dans `app.json` (Apple refuse deux builds avec le même numéro), puis refais les étapes 3 à 8.

Sans Mac, la même chose est possible via le service de build en ligne d'Expo : `npx eas-cli build --platform ios --auto-submit`.

## Structure du code

```
src/
  app/            écrans (Expo Router)
    (tabs)/       Météo, Radar, Vigilance, Villes
  components/     cartes de l'écran Météo
  lib/            appels aux API, stockage, thème, formats
```

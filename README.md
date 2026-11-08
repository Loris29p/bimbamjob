# Météo Pluie 🌧️

Application mobile (iOS / Android) de météo et de pluie pour la France, basée sur les modèles de **Météo-France**.

## Fonctionnalités

Design dans l'esprit des applis météo iOS : fond plein écran qui suit le ciel, grosse température, cartes translucides, défilement entre les villes.

- **Écran principal** (une page par lieu, on glisse de l'une à l'autre)
  - Vigilance Météo-France du département (si jaune ou plus)
  - Pluie dans les 3 h au pas de 15 min (modèle AROME 1,3 km de Météo-France)
  - Heure par heure sur 24 h avec probabilité de pluie, lever et coucher du soleil
  - Prévisions sur 14 jours avec barres de température
  - Heure par heure avec 3 vues : température, pluie (mm + risque), vent (direction + rafales)
  - Qualité de l'air (indice européen, Copernicus CAMS) et comparaison avec la veille
  - Tuiles : vent (boussole + rafales), ressenti, précipitations, humidité et point de rosée, UV, soleil (courbe), pression et tendance, visibilité
  - Phase de la lune (calculée sur le téléphone)
  - **Détail au toucher** : chaque carte ouvre une page avec choix du jour, graphique sur 24 h et comparaison avec la veille
  - En-tête qui se réduit quand on fait défiler, barre flottante en bas
- **Radar** (bouton carte en bas à gauche) : pluie des 2 dernières heures, animée ([RainViewer](https://www.rainviewer.com/api.html))
- **Villes** (bouton liste en bas à droite) : recherche de communes ([Base Adresse Nationale](https://adresse.data.gouv.fr)), position GPS, appui long pour retirer une ville

**Sources de prévisions** (via [Open-Meteo](https://open-meteo.com)) : modèles AROME et ARPEGE de Météo-France en priorité pour l'actuel, l'horaire et les 4 premiers jours ; meilleur modèle disponible (ECMWF…) pour la probabilité de pluie, l'UV, la visibilité et la tendance jusqu'à 14 jours.

Une notification prévient quand de la pluie arrive dans l'heure à ta position (vérifiée à l'ouverture de l'app).

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

## Mettre l'app sur TestFlight avec Expo (EAS), sans Xcode

Le build et l'envoi se font sur les serveurs d'Expo. Gratuit dans la limite de quelques builds par mois.

**Une seule fois, au début :**
1. Crée un compte gratuit sur https://expo.dev, puis `npx eas-cli@latest login`.
2. `npx eas-cli@latest init` : relie le projet à ton compte Expo (ajoute un `projectId` dans `app.json`, à committer).
3. (si tu utilises les vigilances) enregistre ta clé chez Expo, car le fichier `.env` n'est pas envoyé au build :
   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_METEOFRANCE_API_KEY --value ta_cle --environment production --visibility sensitive
   ```

**À chaque nouvelle version :**
```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```
EAS te demande tes identifiants Apple la première fois, crée les certificats, construit l'app, puis l'envoie sur App Store Connect.
Le numéro de build augmente tout seul. Après le traitement d'Apple (10 à 30 min), le build apparaît dans l'onglet **TestFlight**.

Pour mettre à jour seulement le code JavaScript sans repasser par Apple, il existe aussi `eas update` (à configurer plus tard).

## Structure du code

```
src/
  app/            écrans (Expo Router)
    (tabs)/       Météo, Radar, Vigilance, Villes
  components/     cartes de l'écran Météo
  lib/            appels aux API, stockage, thème, formats
```

# Sources de données : les plus fiables pour la France

Principe : **mesurer quand on peut, prévoir avec le modèle le plus fin possible, et ne passer à un modèle moins précis que quand le précédent n'a plus de données.**

| Besoin | Source utilisée | Précision | Pourquoi |
|---|---|---|---|
| **Ce qu'il fait maintenant** (température, vent, rafales, direction, humidité, pluie, pression, visibilité) | **Stations Météo-France** (API officielle « Données Publiques Observation ») : jusqu'à 5 stations à moins de 25 km et à moins de 300 m d'écart d'altitude ; chaque valeur vient de la plus proche qui la mesure (beaucoup de petites stations ne mesurent que la température et la pluie), et les stations en retard de plus de 90 min sont ignorées | Mesure toutes les **6 minutes** | Une vraie mesure bat toujours une prévision. La température affichée en grand est la mesure si la station est à moins de 15 km et la mesure date de moins de 45 min. |
| **Les 6 prochaines heures, toutes les 15 min** (pluie, température, vent, rafales, direction) | **AROME France HD** de Météo-France (via Open-Meteo, `meteofrance_seamless`) | Maille de **1,3 km**, pas de **15 min** | Le modèle le plus fin qui existe sur la France, recalculé plusieurs fois par jour. |
| **Heure par heure jusqu'à J+4** | **AROME** puis **ARPEGE** (Météo-France) | 1,3 km → ~10 km | Modèles de référence de Météo-France, bien calés sur le relief, la côte et les orages. |
| **Probabilité de pluie, indice UV, visibilité** | Meilleur modèle disponible d'Open-Meteo (ECMWF / ICON…) | ~9 km | Météo-France ne publie pas ces variables dans ses modèles ouverts. |
| **De J+5 à J+14** | **ECMWF IFS** (centre européen) | ~9 km | Le modèle mondial le plus fiable à moyen terme. Affiché comme une **tendance**. |
| **Vigilances** (orages, vent, pluie-inondation, canicule…) | **Météo-France**, API officielle « Données Publiques Vigilance » | Département | Source officielle, la même que vigilance.meteofrance.fr. |
| **Qualité de l'air** | **Copernicus CAMS Europe** (via Open-Meteo) | ~10 km | Modèle européen de référence, indice européen (EAQI). |
| **Carte de pluie – passé** | RainViewer (mosaïque des radars, dont ceux de Météo-France), palette « Universal Blue » avec neige séparée, convertie en mm/h (Marshall-Palmer) puis recolorée avec notre palette (neige en blanc rosé) | Images toutes les 10 min, 2 h en arrière (1 h 30 affichée quand AROME prend le relais) | Gratuit et simple à afficher. Le radar officiel Météo-France existe via l'API « Paquet Radar », mais en fichiers bruts lourds pour un téléphone. |
| **Carte de pluie – 1re heure** | **Radar prolongé** : la dernière image radar déplacée selon le mouvement mesuré sur les 30 dernières minutes (un mouvement par quart de la zone, interpolé), qui s'estompe et s'adoucit avec l'échéance | Toutes les 10 min, jusqu'à +1 h après maintenant | Bien plus détaillé qu'un modèle pour l'heure qui vient (comme l'app Météo d'Apple). Le bord d'où arrive la pluie, sans radar, est complété par AROME. |
| **Carte de pluie – futur** | **AROME** (Météo-France) calculé sur une grille de 15 × 15 = 225 points autour de toi (via Open-Meteo), puis dessiné en couleurs | Mode 3 h : fondu progressif radar prolongé → AROME au quart d'heure entre +40 et +70 min, AROME seul jusqu'à +1 h 30. Mode 12 h : heure par heure | Prévision officielle la plus fine. Chaque cumul Open-Meteo (15 min ou 1 h, daté de la fin de sa période) est recalé : quart d'heure daté au milieu de sa période, image horaire de t = pluie de t à t + 1 h. Chaque chargement de la grille compte pour 225 appels Open-Meteo (gratuit jusqu'à 10 000/jour, 600/min), gardé 10 min en cache. |
| **Communes, position** | Base Adresse Nationale (adresse.data.gouv.fr) | — | Service officiel de l'État. |

## Ce qui demande une clé Météo-France (gratuite)

Les **mesures des stations** et les **vigilances** viennent de l'API officielle de Météo-France. Sans clé, l'app fonctionne quand même, avec uniquement les prévisions.

1. Crée un compte sur https://portail-api.meteofrance.fr (ça marche depuis un téléphone).
2. Abonne-toi à **« Données Publiques Observation »** et à **« Données Publiques Vigilance »**.
3. Dans **Mes API**, génère une **clé d'API** (« API Key », sans date d'expiration).
4. Mets-la dans le fichier `.env` à la racine du projet :
   ```
   EXPO_PUBLIC_METEOFRANCE_API_KEY=ta_cle
   ```
   (et pour les builds Expo : `npx eas-cli env:create --name EXPO_PUBLIC_METEOFRANCE_API_KEY --value ta_cle --environment production --visibility sensitive`)

Limites : la clé est incluse dans l'app et l'API Météo-France limite le nombre d'appels par minute. C'est parfait pour un usage perso ou une petite bêta ; pour une app publique avec beaucoup d'utilisateurs, il faudra passer par un petit serveur intermédiaire qui met les données en cache.

## Ce qu'on n'utilise pas (et pourquoi)

- **La « pluie dans l'heure » de l'app Météo-France** : elle passe par une API privée, non documentée, utilisée par leurs propres applis. Pas fiable dans la durée ni autorisée pour un usage tiers. On utilise à la place AROME HD au pas de 15 min, plus le radar.
- **AROME-PI** (prévision immédiate, recalculée toutes les heures, pas de 15 min) : disponible en open data Météo-France, mais en fichiers météo bruts (GRIB) trop lourds pour un téléphone. Piste d'amélioration avec un petit serveur.

# Studio de méditation

Application web personnelle pour composer tes propres séances de méditation :
import audio flexible, mixage multi-couches avec boucle aléatoire, minuteries
et guide de respiration.

- **Aucun backend, aucune clé API** : un dossier statique (`index.html`,
  `style.css`, `app.js`, `audio-engine.js`, `db.js`, `timers.js`),
  déployable sur GitHub Pages.
- **Tes données restent locales** : les pistes audio (fichiers importés,
  enregistrements micro) et les presets vivent dans l'**IndexedDB** de ton
  navigateur. Rien ne part vers un serveur.
- **Fonctionne hors-ligne** une fois ouverte une première fois (service
  worker qui met en cache l'app elle-même — l'audio, lui, est déjà local).

## Mettre en ligne

Dépose le dossier `meditation/` (ou tout le dépôt) sur GitHub Pages, comme
décrit dans le README principal, puis ouvre
`https://<toi>.github.io/lexique/meditation/`.

## Import audio — flexible à volonté

- **Glisser-déposer** ou **parcourir** : sélection multiple, tous formats
  lus par ton navigateur (MP3, WAV, OGG, M4A, FLAC…).
- **Import depuis une URL** : colle un lien direct vers un fichier audio (le
  serveur distant doit autoriser l'accès CORS).
- **Enregistrement micro** : capture directement une consigne vocale ou une
  ambiance, elle rejoint la bibliothèque comme n'importe quelle piste.
- **Sons par défaut** : bouton pour générer trois sons synthétisés (bol
  tibétain, cloche claire, gong grave) sans avoir besoin d'un fichier — utile
  pour la cloche d'intervalle si tu n'as pas encore importé de son.
- Chaque piste : nom modifiable, couleur, tags libres, favori, aperçu de 20 s,
  téléchargement, suppression.

## Mixage multi-couches (jusqu'à 6)

Chaque couche a ses propres réglages :

- **Pistes** : une ou plusieurs pistes de la bibliothèque.
- **Mode** : *Boucle simple* (une piste qui boucle), *Séquence en boucle*
  (les pistes choisies dans l'ordre, en boucle), *Lecture aléatoire en
  boucle* (pioche au hasard parmi les pistes choisies, à l'infini) ou *Une
  seule fois* (joue la sélection dans l'ordre puis s'arrête).
- **Départ aléatoire** : à chaque relance, redémarre à un point différent de
  la piste — variation supplémentaire, y compris en boucle simple.
- **Fondu enchaîné** (0 à 10 s) : transition douce entre deux lectures, y
  compris pour masquer le point de bouclage d'une piste seule.
- **Volume propre**, muet, lecture/arrêt indépendants du reste du mixage.

## Minuteries

- **Session** : durée totale (ou sans limite), préparation avant le début,
  fondu de sortie automatique en fin de séance.
- **Cloche d'intervalle** : joue un son choisi toutes les N minutes,
  indépendamment du mixage en cours.
- Le décompte, l'anneau de progression et la cloche d'intervalle se
  **mettent en pause** exactement quand tu mets la session en pause (aucune
  dérive de temps pendant la pause).

## Guide de respiration

Cercle animé en plein écran avec quatre modèles : carrée 4-4-4-4, 4-7-8,
cohérence cardiaque 5-0-5-0, ou personnalisé (quatre durées libres).

## Presets

Enregistre la configuration complète (couches, modes, volumes, minuteries,
respiration) sous un nom, recharge-la plus tard, exporte/importe-la en JSON
pour la sauvegarder ou la transférer. **Les fichiers audio eux-mêmes ne sont
pas inclus dans l'export** (ils restent dans IndexedDB) — si tu importes un
preset sur un autre appareil ou après un nettoyage du navigateur, réimporte
d'abord les pistes citées par leur nom.

## Raccourcis clavier

`Espace` lecture/pause · `S` stop · `↑`/`↓` volume master · `B` guide de
respiration · `1`–`5` changer d'onglet · `?` aide.

## Limites à connaître

- Les données (audio + presets) vivent dans **ce** navigateur, sur cet
  appareil. Vider les données de navigation les efface — pense à exporter
  tes presets régulièrement (l'audio, lui, doit être réimporté si perdu).
- Le stockage du navigateur a un quota (indiqué en bas de la bibliothèque) ;
  au-delà, l'import peut échouer.
- L'import par URL ne fonctionne que si le serveur distant autorise l'accès
  CORS depuis le navigateur.

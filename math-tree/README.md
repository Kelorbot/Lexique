# Arbre Mathématique

Application web personnelle pour envoyer des photos d'exercices, de cours ou
de notes de mathématiques : chaque image est transcrite automatiquement en
LaTeX et rangée dans une arborescence de branches (Algèbre, Analyse, Séries
entières, Espaces euclidiens…) qui se crée toute seule au fil des imports.

- **Aucun backend** : un simple dossier statique (`index.html`, `style.css`,
  `app.js`, `db.js`), déployable sur GitHub Pages.
- **Une seule clé nécessaire, et gratuite** : ta propre clé API [Gemini](https://aistudio.google.com/apikey)
  (Google AI Studio, avec vision), saisie dans les réglages de l'appli et
  stockée uniquement dans le `localStorage` de ton navigateur. Elle sert à
  appeler directement `generativelanguage.googleapis.com` depuis ton appareil
  — jamais ailleurs. Le niveau gratuit (modèles Flash) suffit largement pour un
  usage personnel ; il n'est pas lié à un abonnement Gemini Pro/Advanced, qui
  ne donne lui aucun accès API.
- **Tes données restent locales** : images et arborescence vivent dans
  l'`IndexedDB` du navigateur. Utilise **Réglages → Exporter (JSON)**
  régulièrement pour ne rien perdre (changement de navigateur, réinitialisation
  du site, etc.), et **Importer** pour restaurer.

## Mettre en ligne

1. Dépose le dossier `math-tree/` (ou tout le dépôt) sur GitHub Pages, comme
   décrit dans le README principal.
2. Ouvre `https://<toi>.github.io/lexique/math-tree/`.
3. Va dans **Réglages** (icône engrenage), colle ta clé API Gemini, vérifie
   l'identifiant du modèle (mets-le à jour si Google en publie un nouveau —
   reste sur un modèle « Flash » pour rester dans le niveau gratuit), puis
   **Enregistrer**.

L'appli n'est pas indexée par les moteurs de recherche et n'a pas de compte —
elle est pensée pour un usage strictement personnel, sur une URL que tu es seul
à connaître.

## Comment ça marche

- **Ajouter des images** : bouton **+**, glisser-déposer sur la scène, ou
  coller (Ctrl/Cmd+V) une image copiée. Chaque image passe dans une file
  visible en bas à droite pendant son analyse. Tu peux **retirer une image de
  la file** (croix ✕) tant qu'elle n'est pas traitée — utile pour ne pas
  solliciter l'API inutilement — et **vider** les analyses terminées.
- **Filtrage automatique des maths** : avant toute transcription, le modèle
  vérifie que l'image relève bien des mathématiques. Si c'est une autre matière
  (physique, chimie, anglais, philosophie…), l'image est **ignorée** (jamais
  ajoutée à l'arbre) et signalée comme telle dans la file.
- **Analyse automatique** : l'image reconnue comme mathématique est transcrite
  fidèlement en LaTeX (texte en français correct, formules valides), reçoit un
  titre court, et est classée dans l'arborescence (ex. `Analyse > Séries
  entières`). Les branches manquantes sont créées automatiquement ; les
  branches existantes sont réutilisées si le sujet correspond.
- **Navigation en arbre** : « Mathématiques » est au centre ; branches,
  sous-branches **et images** rayonnent autour, toutes visibles d'un coup (les
  images apparaissent directement sur la carte, sans avoir à ouvrir une
  branche). **Zoome/dézoome** à la molette, au pincement (mobile) ou avec les
  boutons en bas à gauche, et **déplace-toi** en faisant glisser le fond. Le
  bouton « vue d'ensemble » recadre tout l'arbre. Clique une branche pour la
  sélectionner, une image pour ouvrir sa fiche.
- **Couleurs par domaine** : chaque grand domaine (Algèbre, Analyse,
  Géométrie…) a sa propre couleur, héritée par toutes ses sous-branches et ses
  images — on repère d'un coup d'œil à quel champ appartient chaque bulle.
- **Personnalisation** : **déplace n'importe quelle bulle** en la faisant
  glisser (la position est mémorisée). Le bouton **réorganiser** (icône en bas
  à gauche) remet un **espacement automatique harmonieux** et efface les
  déplacements manuels.
- **Branches à la main** : l'icône branche (en haut) ou le bouton
  **＋ Sous-branche** de la barre d'actions créent une branche ou sous-branche
  manuellement. Une branche sélectionnée peut aussi être **renommée**,
  **réduite/déployée** (pour masquer son contenu) ou **supprimée** (avec tout
  son sous-arbre).
- **Fiche d'une image** : image source, titre et transcription LaTeX rendus
  (dans un panneau légèrement transparent), bouton pour copier le LaTeX brut,
  et un mode édition pour corriger le titre, le LaTeX ou la branche si le
  classement automatique s'est trompé.
- **Fil de discussion par image** : chaque image a sa propre conversation avec
  l'IA (Gemini). Pose une question sur ce document précis — « corrige ma
  démonstration », « donne-moi une indication pour la question 2 », « explique
  cette étape » — et l'IA répond en français avec les formules en LaTeX, en
  gardant l'image et sa transcription comme contexte. L'historique est
  enregistré avec l'image (et inclus dans l'export JSON).
- **Recherche** : la barre en haut filtre instantanément titres, contenu LaTeX
  et noms de branches (insensible aux accents/majuscules).

## Limites à connaître

- Le niveau gratuit de l'API Gemini impose des limites de débit (nombre de
  requêtes par minute/jour) : largement suffisant pour un usage personnel,
  mais évite d'envoyer des dizaines d'images d'un coup.
- Les données vivent dans **ce** navigateur. Vider les données de navigation
  les efface — pense à l'export JSON régulier.
- Le classement automatique n'est pas infaillible : la fiche de chaque image
  reste modifiable à tout moment (titre, LaTeX, branche).

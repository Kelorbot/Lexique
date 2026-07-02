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
  visible en bas à droite pendant son analyse.
- **Analyse automatique** : l'image est envoyée à Gemini avec l'arborescence
  actuelle des branches. Le modèle renvoie un titre, la transcription LaTeX
  complète, et un chemin de classement (ex. `Analyse > Séries entières`). Les
  branches et sous-branches manquantes sont créées automatiquement ; les
  branches existantes sont réutilisées si le sujet correspond.
- **Navigation en arbre** : un tronc central représente la branche courante ;
  ses sous-branches et ses images (feuilles) se déploient tout autour. Clique
  sur une branche pour y entrer, sur une image pour ouvrir sa fiche détaillée.
  Le fil d'Ariane en haut permet de remonter à tout niveau, et le bouton maison
  ramène directement au centre.
- **Fiche d'une image** : image source, titre et transcription LaTeX rendus
  (dans un panneau légèrement transparent), bouton pour copier le LaTeX brut,
  et un mode édition pour corriger le titre, le LaTeX ou la branche si le
  classement automatique s'est trompé.
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

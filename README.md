# Lexique — carnet de vocabulaire bilingue

Petite application web pour chercher des traductions **anglais ⇄ français**, les
sauvegarder automatiquement dans un carnet, et les réviser en flashcards avec
répétition espacée.

- **Aucune installation**, aucune clé API : un seul fichier `index.html`.
- **Traduction** via l’API gratuite [MyMemory](https://mymemory.translated.net/).
- **Mémoire** : le carnet est enregistré dans le `localStorage` du navigateur.
  Il persiste tant que tu utilises le même navigateur sur le même appareil.

## Mettre en ligne sur GitHub Pages

1. Crée un dépôt sur GitHub (par exemple `lexique`).
1. Dépose le fichier `index.html` à la racine du dépôt (bouton **Add file → Upload files**).
1. Va dans **Settings → Pages**.
1. Sous *Build and deployment → Source*, choisis **Deploy from a branch**,
   branche `main`, dossier `/ (root)`, puis **Save**.
1. Après une minute, ton appli est en ligne à l’adresse
   `https://<ton-pseudo>.github.io/lexique/`.

## Comment ça marche

- **Recherche** : choisis le sens, tape un mot, la traduction s’affiche et
  s’ajoute au carnet. Chaque mot est enrichi automatiquement de **synonymes** et
  d’**exemples de phrases** (via le dictionnaire anglais gratuit
  [dictionaryapi.dev](https://dictionaryapi.dev/)).
- **Carnet** : la liste de tous tes mots, avec ton score. Un mot passe en
  « acquis » après 3 bonnes réponses. Déplie *Voir synonymes & exemples* pour
  les détails. Tu peux aussi **ajouter une expression à la main** (avec ses
  synonymes et un exemple) grâce au formulaire en haut du carnet.
- **Révision** : des flashcards, avec deux modes au choix —
  - **Adaptatif** : les mots que tu rates reviennent plus souvent ;
  - **Aléatoire** : tirage uniforme parmi tous tes mots.

  L’exemple d’utilisation, s’il existe, s’affiche au dos de la carte.

## Limites à connaître

- MyMemory est gratuit mais plafonné (quelques milliers de mots/jour par IP) —
  largement suffisant à l’échelle d’un usage personnel.
- Le carnet vit dans **ce** navigateur. Vider les données de navigation l’efface.
  Pour une sauvegarde durable, on pourrait ajouter un export/import JSON.

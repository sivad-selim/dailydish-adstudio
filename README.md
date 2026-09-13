# DailyDish Ad Studio

Outil privé de création, traduction, organisation et publication des posts DailyDish sur les comptes Instagram EN, FR et BR.

## Développement et vérification

Node.js 22.13 ou supérieur.

```sh
npm ci
npm run dev
npm test
npm run build:firebase
python3 -B -m unittest discover -s tests -p '*_test.py'
```

`npm test` vérifie les types et les tests du Studio. Pour les tests d’intégration Firestore, démarrer un émulateur avec `firestore.ad-studio.rules`, puis lancer :

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8788 node --test tests/post-persistence.test.mjs
```

Ces tests ciblent un projet `demo-…` isolé. Ils ne publient rien sur Instagram et n’écrivent pas en production.

## Données

Le [modèle des posts](docs/post-model.md) décrit les pages possédées par chaque post, leurs traductions intégrées et les opérations atomiques d’édition. Les textes ne sont plus partagés entre posts.

L’[outil de traduction](docs/post-translations.md) utilise la connexion Google locale pour lire et traduire les pages demandées depuis une conversation, avec sauvegarde et protection contre les modifications concurrentes.

L’[outil de création](docs/post-creation.md) crée des posts simples ou une galerie depuis des images locales utilisées comme fonds et des textes traduits. Il réutilise les réglages du Studio, prépare un plan vérifiable et permet de reprendre un import sans doublons. Les posts restent en brouillon.

## Production

Le Studio est hébergé sur Firebase Hosting, cible `ad-studio`, et utilise la base Firestore nommée `ad-studio` du projet `daily-dish-b10b4`.

Les fonctions serveur Instagram et de planification sont dans le dépôt `sivad-selim/dailydish`, sous `functions/src/adStudio/`. Les tokens Instagram restent dans Secret Manager. Voir [la connexion Instagram](docs/instagram-connection.md).

Le build Firebase est produit dans `firebase-dist/`. Les fichiers de travail et sauvegardes sont ignorés par Git. Aucun commit ni push automatique.

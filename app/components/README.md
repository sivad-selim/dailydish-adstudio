# Composants communs Ad Studio

Cette couche interne utilise React et Nunito déjà présents dans le projet. Aucun framework ni package supplémentaire.

- `PageHeader` : titre et description de chaque vue, avec actions à droite.
- `SectionHeading` : bandeau violet clair pour les sections et les dossiers ; compteurs en violet sans pastille. Accepte `header` et `summary`.
- `Dropdown` : unique select natif avec icône Material, focus et dimensions communs.
- `Button` : actions principales violettes, secondaires blanches, destructives rouges ; conserve les attributs natifs et les événements.
- `Icon` : SVG Material locaux, même grille de 24 px, rendus à 20 px. Le bouton parent porte le libellé accessible.
- `PostPreview` : couverture, badge galerie et statut EN / FR / BR, partagés entre Posts, calendrier et sélecteur. Les actions et événements de drag restent dans les vues parentes. Aucun bouton imbriqué dans le mode sélecteur.
- `studio.css` : couleurs, typographie, espacement, rayons et présentation des composants. Importé après les styles des vues dans les deux points d’entrée.

Les couleurs de l’interface utilisent `--studio-*`. Les thèmes des créations, le placement des images et le rendu des exports appartiennent à `CreationCanvasPreview` et `.ad-canvas` : ne pas leur appliquer les styles de l’interface.

Une nouvelle section doit réutiliser ces composants. Ajouter une variante ici plutôt qu’une nouvelle règle propre à une page. Conserver les petits aperçus ; le calendrier adapte uniquement leur largeur à ses sept colonnes.

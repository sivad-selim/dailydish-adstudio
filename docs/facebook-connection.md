# Publication Facebook depuis Ad Studio

La fenêtre de publication manuelle permet de choisir Instagram, Facebook ou les deux, puis les pays de chaque réseau. Instagram reste sélectionné par défaut. Chaque destination conserve son propre texte, ses images et son résultat. Les visuels sont les mêmes JPEG 1080 × 1350 préparés pour Instagram, avec la traduction du pays (BR utilise le portugais). La légende reste limitée à 2 200 caractères pour ce parcours commun.

| Pays | Page | Identifiant |
| --- | --- | --- |
| EN | DailyDish | 1207160595823403 |
| FR | DailyDish - fr | 1289897627544141 |
| BR | DailyDish - br | 1268961959637083 |

## Accès et installation

L’application Meta doit disposer de `pages_show_list`, `pages_read_engagement` et `pages_manage_posts` pour les trois pages. L’utilisateur qui fournit les accès doit avoir le droit de créer leur contenu. Les jetons Instagram ne peuvent pas remplacer les jetons de Page Facebook.

Avant l’installation, vérifier la durée de validité dans le Débogueur Meta. Les jetons obtenus directement depuis une session de l’Explorateur peuvent être temporaires : préparer les jetons de Page via un jeton utilisateur de longue durée, puis vérifier leurs dates d’expiration et les étendues granulaires. Une absence de date d’expiration ne protège pas contre une révocation ou un changement d’accès.

Lancer dans un terminal interactif :

```sh
python3 scripts/install-facebook-tokens.py
```

Le script demande les trois jetons sans les afficher, vérifie en lecture seule que `/me` correspond à la Page attendue, puis installe le JSON `{en, fr, br}` dans `AD_STUDIO_FACEBOOK_TOKENS`, projet `daily-dish-b10b4`. Aucun jeton n’est écrit dans le dépôt ou passé dans les arguments de commande. Le script ne publie pas et ne déploie pas.

Après installation, déployer depuis `dailydish-kmp` les fonctions `verifyAdStudioFacebook`, `publishAdStudioFacebook`, `resetAdStudioFacebookPublication` et `resetAdStudioInstagramPublication`. Déployer également les règles Firestore de la base `ad-studio`, les règles du bucket Ad Studio et le hosting depuis ce projet. La nouvelle interface attend la lecture des deux collections : déployer les règles avant le hosting. Vérifier les trois connexions via `verifyAdStudioFacebook` avant le premier envoi.

Ne pas effectuer une publication réelle de test sans l’autorisation explicite du propriétaire pour le contenu et les destinations.

## Envoi et reprises

Le serveur vérifie le propriétaire du Studio, l’entrée du calendrier, le nombre de pages et le chemin de chaque image. Il vérifie l’identité du jeton de Page avant d’utiliser l’API Facebook v26.0. Les exports sont dans `facebook-publishing/{uid}/{entryId}/{account}/{uuid}.jpg` ; les mêmes restrictions que pour Instagram s’appliquent : propriétaire uniquement, création JPEG de moins de 8 Mo, pas de remplacement client.

Les photos sont téléversées avec `published=false`, puis une seule publication `/PAGE_ID/feed` est créée avec `attached_media`, dans l’ordre des images. Il s’agit d’une publication photo Facebook, pas d’un carrousel publicitaire. Le suivi est enregistré dans `facebook-publications` avec une clé déterministe par entrée et pays. Seul le serveur peut écrire cette collection.

Un verrou transactionnel empêche deux envois simultanés vers la même destination. Un résultat publié est réutilisé. Un refus explicite de Facebook autorise une nouvelle tentative avec les visuels et la légende d’origine. Les photos non publiées sont alors téléversées à nouveau, car elles peuvent avoir expiré.

Avant le POST public, le serveur persiste `publishAttempted`. Une réponse perdue ou un arrêt après cette étape produit un résultat incertain : aucune répétition du POST n’est permise. Le propriétaire doit vérifier sa page ; le Studio ne prétend pas réconcilier automatiquement ce cas. Une résolution administrative du suivi pourra être nécessaire après vérification du résultat réel.

Effacer le suivi d’un envoi réussi archive son historique dans Firestore et ne supprime pas la publication Facebook. La date globale du calendrier reste renseignée si une autre destination Instagram ou Facebook est toujours publiée. Les cartes affichent séparément les pays publiés sur chaque réseau.

La programmation automatique reste dédiée à Instagram. Le rapport commun inclut les étapes et résultats des publications manuelles Facebook avec le réseau, le pays, le visuel et le lien du post. Les événements Facebook sont enregistrés dans la même transaction que l’état de la publication. À la consultation du rapport, une migration par lots récupère les états Facebook antérieurs (marqués « Historique récupéré »), sans inventer les événements intermédiaires qui n’avaient pas été enregistrés. Déployer aussi `getAdStudioScheduleReports` avec cette version.

## Vérification

- Frontend : `npm test` et `npm run build:firebase`.
- Backend : compilation et tests `lib/adStudio/*.test.js` dans le projet functions.
- Les tests utilisent des réponses Meta simulées, sans publication réelle. Les tests nécessitant les émulateurs restent conditionnels.

Références : [jeton d’une Page précise](https://www.postman.com/meta/facebook/request/tass6hw/get-specific-page-access-token), [photos de Page](https://developers.facebook.com/docs/graph-api/reference/page/photos/), [publications de Page](https://developers.facebook.com/docs/pages-api/posts/).

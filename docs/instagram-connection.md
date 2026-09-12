# Instagram dans l’Ad Studio

## Utilisation

Dans Calendrier, ouvrir une entrée. La fenêtre affiche la date prévue, les variantes EN/FR/BR et une légende modifiable par langue. Les trois destinations sont cochées initialement. Les cases se trouvent sous le bouton Publier. Les textes sont ceux de la campagne liée à la création : EN → en, FR → fr, BR → pt. Aucun fallback vers une autre langue ; titre, description et légende peuvent être vides.

Cette version publie uniquement les posts contenant une image. Les galeries de plusieurs pages restent planifiables mais leur publication est désactivée. L’export utilise le rendu existant sans le placeholder « Votre titre », puis un JPEG 1080 × 1350. Les formats plus hauts sont contenus dans ce cadre avec des marges crème : aucun recadrage. L’aperçu est le JPEG exact envoyé. La date du calendrier ne déclenche pas d’envoi automatique.

Le bouton Publier envoie immédiatement vers les comptes sélectionnés. Le récapitulatif affiche un résultat par compte, le lien si disponible, le message d’erreur et une reprise individuelle. Les comptes réussis ne sont pas renvoyés. Une tentative existante conserve son JPEG et sa légende d’origine. La vérification de connexion indépendante reste dans le calendrier.

## Backend et historique

- `verifyAdStudioInstagram` vérifie le propriétaire Firebase Auth, puis l’identité du token sur `/v25.0/me`.
- `publishAdStudioInstagram` contrôle aussi que l’entrée existe et que le post contient une seule image. Les tokens sont exclusivement dans `AD_STUDIO_INSTAGRAM_TOKENS`, Secret Manager, projet `daily-dish-b10b4`.
- Les tentatives sont dans la collection `instagram-publications` de la base Firestore nommée `ad-studio`. Identifiant déterministe par entrée + compte, verrou transactionnel de 180 secondes, fonction limitée à 120 secondes. Seul le serveur écrit cette collection ; le propriétaire du Studio peut lire.
- Chaque image exportée est déposée dans `instagram-publishing/{uid}/{entryId}/{account}/{uuid}.jpg` du bucket `daily-dish-b10b4-ad-studio`. Création propriétaire uniquement, JPEG ≤ 8 Mo, pas de modification cliente. Le serveur fournit à Meta un lien de téléchargement de cet export ; les sources restent privées. Les exports sont conservés pour l’aperçu et les reprises.
- Création du conteneur → état FINISHED → sauvegarde du point de reprise → media_publish → sauvegarde du succès → lecture du permalink. Aucun POST de publication automatique lors d’un test de connexion ou de l’ouverture de la fenêtre.
- Si la réponse de publication est incertaine, seule la consultation du même conteneur est permise. Tant que Meta ne confirme pas PUBLISHED, ne pas créer aveuglément un second post. Le lien peut manquer après récupération d’un succès dont la réponse a été perdue. Une intervention peut être nécessaire si Meta ne donne jamais de résultat définitif.
- Le calendrier passe à publié dès qu’au moins un compte a réussi ; le récapitulatif donne le détail par compte. Une nouvelle entrée du calendrier représente une nouvelle intention de publication.
- App Check est désactivé uniquement pour les deux callables Studio (pas encore de provider web). L’identité propriétaire vérifiée reste obligatoire. Les autres fonctions mobiles conservent leur configuration.

## Installer ou remplacer les tokens

Dans un terminal local personnel :

```sh
python3 scripts/install-instagram-tokens.py
```

Saisie masquée EN, FR, BR. Aucun token dans le chat, le frontend ou un fichier du projet. Les éventuels logs Firebase temporaires sont isolés puis supprimés. Après une modification du secret, redéployer les deux fonctions pour utiliser sa nouvelle version. L’expiration exacte des tokens manuels est inconnue ; le renouvellement automatique reste à ajouter.

## Déploiement ciblé

Depuis `../dailydish-kmp` :

```sh
firebase deploy --only functions:verifyAdStudioInstagram,functions:publishAdStudioInstagram --project daily-dish-b10b4 --non-interactive
```

Depuis l’Ad Studio :

```sh
npm run typecheck:firebase
npm run build:firebase
firebase deploy --only firestore:rules,storage:ad-studio,hosting:ad-studio --project daily-dish-b10b4 --non-interactive
```

## Validation

Tests serveur : contrôle d’accès, identité réelle des comptes, validation d’entrée et de chemin, création/publication, reprise idempotente, réponse perdue, erreur définitive, traitement différé, erreur de lien et masquage des secrets. Tests frontend : mapping BR/pt et textes manquants sans fallback. Les tests simulent Meta ; le premier envoi public doit être déclenché par l’utilisateur après inspection des aperçus.

Référence : https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing

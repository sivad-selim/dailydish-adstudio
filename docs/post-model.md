# Modèle des posts

Un post possède ses pages. Chaque page possède son message multilingue et son visuel. Il n’existe plus de bibliothèque de campagnes ou de messages partagés.

| Collection | Données et responsabilité |
| --- | --- |
| `posts/{id}` | `folderId`, `pageIds` ordonnés, propriétaire et dates. L’ID reste stable quand le titre change. |
| `post-pages/{id}` | `postId`, `translations.en/fr/pt` avec `title` et `description`, nom interne et paramètres visuels existants. |
| `post-folders/{id}` | Nom du dossier, ordre facultatif des posts, propriétaire et dates. |

Un post contient de 1 à 10 pages distinctes. Une seule page correspond à une image ; plusieurs pages correspondent à une galerie. Ce type est calculé et n’est pas sauvegardé une deuxième fois. Les images restent dans la galerie Firebase Storage ; leurs références, positions et layouts sont conservés.

## Édition

- Le panneau **Pages** et les aperçus utilisent le même ordre `pageIds`.
- Réordonner une page déplace son message et son visuel ensemble.
- **Intervertir les messages** échange les titres et descriptions EN, FR et BR entre deux pages. Les visuels restent à leur place.
- Ajouter une page ajoute un message vide. Dupliquer une page ou un post crée des IDs distincts et des textes indépendants.
- Le transfert d’une page entre posts met à jour les deux ordres et son propriétaire dans une transaction. Supprimer la dernière page supprime son post.
- La sauvegarde des textes ne touche qu’aux champs modifiés. Une modification concurrente du même champ est refusée. La sauvegarde du layout ne réécrit jamais les traductions.
- Une sauvegarde visuelle sans changement n’écrit rien : consulter un post n’invalide pas ses images préparées.

La publication manuelle, le calendrier, les exports et les aperçus lisent directement les traductions des pages. La préparation des publications programmées vérifie les versions du post et de toutes ses pages.

## Boutons des stores

Chaque page conserve dans `properties.storeButtons` l’activation (désactivée par défaut), la disposition (`row` ou `column`), la marge depuis le bas (`bottomMargin`, de 0 à 80 % de la hauteur de la page, 6 % par défaut), la taille commune (`scale`, de 25 à 150 %, 100 % par défaut) et les références `iosAssetId` / `androidAssetId`. À la première activation, le Studio retrouve `store_apple.png` et `store_google.png` dans le dossier Galerie **Components**, sans distinction de casse pour le dossier. Les références restent stables même si les images sont ensuite déplacées.

Les deux visuels sont centrés horizontalement, avec une largeur de référence de 38,4 % de la page chacun, ajustable par le réglage Taille tout en conservant leurs proportions d’origine. Ils utilisent le rendu et l’export communs aux aperçus, PNG et publications. Si un visuel activé manque, l’export signale l’erreur au lieu de produire une image incomplète. Les réglages des boutons sont indépendants du texte, du thème et des images libres.

## Conversion unique des données existantes

`scripts/migrate-owned-pages.py` sert uniquement à convertir la base antérieure. L’application ne contient pas de chemins de compatibilité avec celle-ci.

```sh
python3 scripts/migrate-owned-pages.py
python3 scripts/migrate-owned-pages.py --write
```

Le premier appel ne modifie rien. Le second sauvegarde les documents bruts dans `work/before-owned-pages-*.json`, puis effectue une seule écriture atomique avec préconditions sur les versions lues. Il conserve les IDs des posts et de leurs pages, les layouts, les textes, les dossiers et le calendrier. Les groupes de textes sans post deviennent des brouillons ; aucun texte n’est supprimé faute d’utilisation.

Le script relit toutes les données après la conversion et vérifie leur égalité avec le résultat attendu. Les anciennes collections sont supprimées dans la même opération. Il conserve les publications déjà préparées uniquement si leurs versions étaient encore valides avant la conversion. Les sauvegardes et rapports restent hors Git.

Pour déployer ce changement, suspendre le déclencheur de planification pendant la bascule, déployer les règles de la base `ad-studio`, effectuer la conversion puis déployer le Studio et les fonctions qui lisent ses pages. Réactiver ensuite le déclencheur. Le projet Firebase est `daily-dish-b10b4` ; les autres bases ne sont pas concernées.

# Programmation Instagram du calendrier

Les réglages communs sont 20:00, America/Sao_Paulo (Rio), avec Europe/Paris disponible. Le calendrier conserve des dates civiles, indépendantes du fuseau du navigateur. Modifier les réglages s’applique aux échéances futures. Une date dépassée ne déclenche aucun rattrapage.

## Préparation

Un dépôt ou changement de date attribue une nouvelle `scheduleRevision`. Le navigateur prépare les images EN, FR et BR avec le moteur d’export existant, puis les transfère dans Storage. Les callables `prepareAdStudioSchedule` (begin/finish/failed) contrôlent l’identité du propriétaire, la révision, les pages, les versions Firestore et les chemins des JPEG. La programmation devient prête seulement après enregistrement de toutes les images et légendes. Une traduction ou création modifiée nécessite « Actualiser ». Les anciennes entrées futures sans révision sont préparées à l’ouverture du calendrier. Les dates passées restent inchangées.

Les exports sont une version figée. Aucun rendu ne dépend d’un navigateur à l’heure d’envoi. Une fermeture pendant la préparation laisse une préparation incomplète, à actualiser. Les repères du téléphone ne font pas partie de l’export.

## Exécution

`dispatchAdStudioSchedule`, Cloud Scheduler chaque minute UTC, compare l’heure courante dans le fuseau configuré. Seule la minute d’échéance est éligible : pas de scan de rattrapage. Les exports doivent avoir été prêts avant le début de cette minute. Une modification d’horaire pendant la minute ne déclenche pas un envoi immédiat.

Le dispatcher crée des tentatives durables EN, FR et BR. `runAdStudioScheduledPublication`, déclenchée sur création Firestore, traite chaque compte indépendamment. Les contrôles de date/révision/contenu sont refaits lors de l’acquisition et juste avant l’appel public de publication. Après le début de l’appel à Instagram, un retrait ne peut pas rappeler cet appel.

Les fonctions manuelle et automatique partagent `publishStudioInstagram`, le même document de suivi et le même verrou par entrée/compte. Une tentative automatique existante n’est jamais rejouée, même après changement de date ou effacement du suivi manuel. Les erreurs se reprennent manuellement depuis le post. Une réponse incertaine réutilise le conteneur existant, sans nouvelle publication aveugle.

Les travailleurs s’exécutent indépendamment pour que l’échec d’un compte n’empêche pas les autres. Il n’y a pas de garantie à la seconde près : Cloud Scheduler, le démarrage du travailleur et le traitement Meta ajoutent un délai. Une interruption de plus de 12 minutes est inscrite dans le rapport sans relancer l’envoi.

## Données et rapport

- `publication-plans/main` : dates et révisions des entrées (éditeur propriétaire).
- `publication-settings/main` : heure, fuseau, date de modification (serveur).
- `publication-schedules/{entryId}` : version préparée, légendes et exports (serveur).
- `publication-schedule-runs` : anti-doublon entrée/jour (serveur privé).
- `publication-schedule-attempts` : tentative définitive entrée/compte (serveur).
- `publication-reports` : événements persistants ; pages de 50 événements, regroupés par journée dans le fuseau sélectionné. Le callable propriétaire `getAdStudioScheduleReports` retourne uniquement la page demandée et un comptage agrégé. Les curseurs servent à la navigation séquentielle ; un saut vers une page inconnue utilise un offset côté serveur (les lectures sautées restent facturées par Firestore). Une borne temporelle stabilise les pages pendant la consultation. La première page suit les nouveaux événements ; sur les pages anciennes, un bouton propose de les actualiser. Le cache du navigateur est limité à 10 pages.

Les tokens Instagram restent dans Secret Manager. Aucun token n’est stocké dans ces documents. Les règles Firestore autorisent la lecture des rapports et préparations uniquement au propriétaire, leur écriture uniquement aux fonctions serveur.

## Vérification / déploiement

Backend dans `dailydish-kmp/functions` : build TypeScript et `node --test lib/adStudio/*.test.js`.
Les tests `schedulingIntegration.test.js` nécessitent `FIRESTORE_EMULATOR_HOST` et utilisent exclusivement le projet fictif `demo-adstudio-scheduling`. Ils ne publient pas sur Instagram.

Déployer les fonctions `publishAdStudioInstagram`, `setAdStudioScheduleSettings`, `prepareAdStudioSchedule`, `dispatchAdStudioSchedule`, `runAdStudioScheduledPublication`, `reportAdStudioPlanChanges`, `getAdStudioScheduleReports` depuis dailydish-kmp. Déployer les règles du database ad-studio et le hosting depuis dailydish-web-ad-studio. Les tests n’activent aucune publication réelle.

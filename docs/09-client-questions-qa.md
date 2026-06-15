# Questions client - réponses proposées

Ce document propose une première série de réponses aux questions client, sur la base du POC Dolibarr MJL actuellement en place.

Les réponses ci-dessous reposent sur les hypothèses suivantes :

- Le besoin prioritaire est le suivi financier et budgétaire des projets financés par des PTF, avec traçabilité des dépenses, pièces justificatives, validations et rapports.
- Le POC ne remplace pas encore une comptabilité complète OHADA. Il prépare un outil de suivi projet/bailleur qui peut s'interfacer avec la comptabilité.
- Les premiers cas couverts sont UNICEF, le programme Redevabilité et un projet test d'extension.
- Les réponses doivent être validées en atelier avec la DPAF, la DPJJE, les responsables projets et les points focaux bailleurs.

## A. Clarification du besoin réel

### 1. Quelle est votre priorité principale : la comptabilité OHADA complète, le suivi budgétaire des projets, ou le reporting aux partenaires techniques et financiers ?

La priorité retenue pour le POC est le suivi budgétaire des projets et le reporting aux partenaires techniques et financiers. La comptabilité OHADA complète reste un besoin important, mais elle doit être traitée comme une phase ultérieure ou comme une intégration avec les fonctions comptables standard de Dolibarr.

### 2. Le logiciel doit-il remplacer totalement vos outils actuels, ou venir en appui à des fichiers Excel/procédures existantes ?

Hypothèse POC : le logiciel vient d'abord en appui aux procédures existantes et aux fichiers Excel. Il doit progressivement structurer les données, centraliser les pièces justificatives et fiabiliser les rapports. Le remplacement complet des fichiers Excel ne doit intervenir qu'après validation des workflows et des rapports.

### 3. Quel problème concret souhaitez-vous résoudre en priorité ?

Le problème prioritaire est la traçabilité complète entre financement reçu, projet, convention, activité, ligne budgétaire, dépense, pièce justificative, validation et rapport. Les problèmes associés sont le suivi budgétaire, les alertes sur dépassement, l'archivage des pièces et la production de rapports bailleurs.

## B. Projets et bailleurs concernés

### 4. Quels sont les projets à intégrer dès la première version du logiciel ?

La première version doit intégrer au minimum :

- PRJ-JE-2026 : Projet Justice Enfants, financé par UNICEF.
- PRJ-RED-2026 : Projet Redevabilité Institutionnelle.
- PRJ-EXT-2026 : projet test pour vérifier l'extension à d'autres PTF.

### 5. Les financements UNICEF et « Redevabilité » ont-ils des règles de gestion différentes ?

Hypothèse POC : oui, chaque bailleur peut avoir ses propres règles de gestion, notamment sur les lignes budgétaires, les pièces exigées, la fréquence des rapports et le format des rapports. Le système doit donc rattacher les règles à la convention, au bailleur ou au projet.

### 6. Existe-t-il des modèles de rapports imposés par l'UNICEF ou par le programme « Redevabilité » ?

Hypothèse POC : des modèles spécifiques peuvent exister, mais ils ne sont pas encore formalisés dans le POC. Le système prévoit des rapports fixes, notamment une synthèse financière par projet, une exécution budgétaire par convention et une liste des dépenses avec pièces justificatives. Les canevas officiels UNICEF/Redevabilité doivent être collectés et ajoutés au backlog.

### 7. Utilisez-vous actuellement des formulaires ou canevas spécifiques tels que FACE, HACT, rapports financiers bailleurs, tableaux de suivi budgétaire ou rapports d'utilisation des fonds ?

Hypothèse POC : oui, certains canevas bailleurs existent ou seront requis. Pour la première version, il faut collecter les modèles utilisés par la DPAF et les bailleurs afin de les transformer en exports Excel/PDF. Les canevas FACE, HACT et rapports d'utilisation des fonds doivent être confirmés avec les équipes.

## C. Référentiel comptable et conformité

### 8. Quel référentiel comptable doit être appliqué : SYSCOHADA, SYCEBNL, comptabilité publique, règles internes du MJL, ou exigences spécifiques des bailleurs ?

Hypothèse POC : le suivi financier doit respecter les règles internes du MJL et les exigences spécifiques des bailleurs. Pour la comptabilité officielle, le référentiel à confirmer est SYSCOHADA/SYCEBNL selon le statut applicable. Le POC ne tranche pas encore ce point juridico-comptable.

### 9. Disposez-vous déjà d'un plan comptable utilisé pour ces projets ?

Hypothèse POC : un plan comptable ou une nomenclature budgétaire existe probablement dans les fichiers actuels. Il doit être collecté. Pour le POC, les lignes budgétaires sont structurées par projet, convention, activité et catégorie de dépense.

### 10. Le logiciel doit-il gérer une vraie comptabilité en partie double, avec débit/crédit, journaux, grand livre et balance ? Ou souhaitez-vous plutôt un outil de suivi financier par projet, budget, activité, dépense et bailleur ?

Réponse proposée : pour la première version, l'objectif est un outil de suivi financier par projet, budget, activité, dépense et bailleur. La comptabilité en partie double peut être couverte par Dolibarr standard ou par une phase ultérieure, mais elle n'est pas l'objet principal du module POC.

### 11. Quels états financiers doivent obligatoirement être produits par le logiciel ?

Pour la première version, les états prioritaires sont :

- synthèse financière par projet ;
- exécution budgétaire par convention ;
- liste des dépenses avec statut et pièces justificatives ;
- situation des fonds reçus ;
- état des soldes disponibles par projet, convention et ligne budgétaire.

### 12. Ces états doivent-ils être conformes à un format officiel OHADA, à un format bailleur, ou à un format interne du MJL ?

Hypothèse POC : les rapports opérationnels doivent d'abord respecter les formats bailleurs et internes MJL. Les états financiers OHADA officiels relèvent d'un périmètre comptable plus large et devront être confirmés séparément.

## D. Processus actuels

### 13. Pouvez-vous décrire le processus actuel depuis la réception des fonds jusqu'à la justification des dépenses ?

Processus cible retenu pour le POC :

1. Enregistrement du bailleur/PTF.
2. Création du projet et de la convention.
3. Création des activités et lignes budgétaires.
4. Enregistrement des fonds reçus avec preuve de réception.
5. Saisie de la dépense avec rattachement projet, convention, activité et ligne budgétaire.
6. Téléversement ou référencement de la pièce justificative.
7. Soumission de la dépense.
8. Validation, correction ou rejet.
9. Mise à jour de l'exécution budgétaire.
10. Production des rapports.

### 14. Qui initie une dépense ?

Hypothèse POC : la dépense est initiée par le comptable projet ou un agent habilité de saisie, sur la base d'une demande provenant du responsable projet ou du service bénéficiaire.

### 15. Qui valide une dépense ?

Hypothèse POC : la dépense est validée par un validateur financier habilité, distinct du profil de saisie. Le POC prévoit un rôle `VALIDATEUR`.

### 16. Qui saisit les opérations comptables ou financières ?

Hypothèse POC : le comptable projet saisit les fonds reçus, les dépenses et les informations financières. Le POC prévoit un rôle `COMPTABLE`.

### 17. Qui contrôle les pièces justificatives ?

Hypothèse POC : le contrôle est assuré par le validateur financier, éventuellement avec consultation par le responsable projet ou un profil audit/lecture.

### 18. Qui produit les rapports financiers ?

Hypothèse POC : les rapports sont produits par la DPAF ou par les profils comptable, responsable projet et administrateur, selon les droits d'export définis.

### 19. Quelles sont les principales difficultés rencontrées aujourd'hui dans ce processus ?

Les difficultés supposées sont :

- données dispersées dans plusieurs fichiers ;
- difficulté à relier une dépense à une activité, une ligne budgétaire et une pièce justificative ;
- suivi manuel des soldes disponibles ;
- risque de dépassement budgétaire ;
- production de rapports chronophage ;
- historique des corrections et validations insuffisamment centralisé.

### 20. Quels documents ou fichiers utilisez-vous actuellement pour suivre les projets ?

Hypothèse POC : fichiers Excel de suivi budgétaire, rapports financiers bailleurs, tableaux de dépenses, dossiers de pièces justificatives, conventions de financement et preuves de réception de fonds. Les fichiers exacts doivent être collectés.

### 21. Existe-t-il déjà des modèles Excel que le logiciel devra reprendre ou remplacer ?

Hypothèse POC : oui. Les modèles Excel doivent être repris comme base pour les premiers exports afin de limiter le changement côté utilisateurs.

## E. Budgets, dépenses et justificatifs

### 22. Les budgets sont-ils suivis par projet, par bailleur, par activité, par ligne budgétaire, par nature de dépense, ou par service ?

Le POC suit les budgets par projet, bailleur/PTF, convention, activité et ligne budgétaire. La nature de dépense est représentée par une catégorie de ligne budgétaire. Le suivi par service peut être ajouté si le client le confirme.

### 23. Une dépense doit-elle être rattachée obligatoirement à une activité ou à une ligne budgétaire ?

Oui. Pour garantir le reporting et le contrôle budgétaire, une dépense doit être rattachée au minimum à un projet, une convention, une activité et une ligne budgétaire.

### 24. Souhaitez-vous bloquer une dépense si elle dépasse le budget disponible ? Ou seulement signaler le dépassement sans bloquer l'utilisateur ?

Hypothèse POC : à la validation, le dépassement doit bloquer la validation ou conduire au rejet, sauf autorisation spéciale. Le jeu de données contient un cas de rejet pour dépassement budgétaire. Une option de simple alerte peut être prévue pour la saisie initiale.

### 25. Quelles pièces justificatives sont obligatoires pour enregistrer une dépense ?

Hypothèse POC : au minimum une pièce justificative est obligatoire pour qu'une dépense soit considérée complète. Selon le type de dépense, il peut s'agir d'une facture, d'un bon de commande, d'un ordre de mission, d'un état de perdiem, d'un reçu, d'un contrat ou d'un rapport d'activité.

### 26. Les pièces justificatives doivent-elles être téléversées dans le logiciel ?

Oui. Le POC prévoit le rattachement des pièces via Dolibarr Documents/ECM. La première version doit permettre de conserver les pièces avec les dépenses et les fonds reçus.

### 27. Les pièces justificatives doivent-elles être validées avant que la dépense soit considérée comme complète ?

Oui. Une dépense sans pièce justificative doit rester en brouillon ou être signalée comme incomplète. La validation financière doit contrôler la présence et la conformité de la pièce.

### 28. Quels types de dépenses doivent être suivis ?

Les types prioritaires sont : missions, ateliers, prestations, achats, frais de fonctionnement, subventions, remboursements, communication, logistique, production de rapports, transport et perdiem.

## F. Utilisateurs et rôles

### 29. Quels profils d'utilisateurs utiliseront le logiciel ?

Les profils POC sont :

- administrateur POC ;
- comptable projet ;
- responsable projet ;
- validateur financier ;
- lecteur/audit.

### 30. Combien d'utilisateurs sont prévus au démarrage ?

Le POC démarre avec 5 utilisateurs types. En production, le nombre exact doit être confirmé, mais une hypothèse raisonnable de démarrage est 5 à 15 utilisateurs.

### 31. Les agents de la DPAF et de la DPJJE doivent-ils avoir les mêmes droits ?

Hypothèse POC : non. La DPAF doit disposer de droits financiers plus larges, notamment saisie, contrôle, validation ou reporting. La DPJJE doit plutôt disposer de droits liés au suivi projet, à la consultation et éventuellement à l'initiation de demandes.

### 32. Faut-il prévoir des rôles différents : saisie, validation, contrôle, consultation, administration, audit ?

Oui. Le POC prévoit déjà une séparation des rôles : administration, comptabilité/saisie, responsable projet, validation financière et lecture/audit.

### 33. Qui doit pouvoir modifier ou annuler une opération déjà enregistrée ?

Hypothèse POC : une opération en brouillon peut être modifiée par son auteur ou un administrateur. Une opération soumise ou validée ne doit pas être modifiée librement. Elle doit passer par correction, rejet, annulation ou écriture d'ajustement selon les règles validées.

### 34. Une modification doit-elle obligatoirement garder l'historique de l'ancienne valeur ?

Oui. Les modifications importantes doivent conserver un historique, notamment pour les dépenses soumises, validées, corrigées ou rejetées.

### 35. Un supérieur doit-il valider certaines actions avant qu'elles soient définitives ?

Oui. Les dépenses soumises doivent être validées par un profil habilité. Les actions sensibles, comme validation, rejet, correction ou annulation, doivent être tracées.

## G. Rapports et exports

### 36. Quels rapports doivent être disponibles dès la première version ?

Les rapports prioritaires sont :

- RPT-001 : synthèse financière par projet ;
- RPT-002 : exécution budgétaire par convention ;
- RPT-003 : liste des dépenses avec pièces justificatives.

### 37. À quelle fréquence les rapports sont-ils produits ?

Hypothèse POC : les rapports doivent être disponibles à la demande, avec filtres de période. Les fréquences usuelles à prévoir sont mensuelle, trimestrielle, semestrielle, annuelle et selon demande du bailleur.

### 38. Les rapports doivent-ils être exportables en PDF, Excel, Word ou autre format ?

Oui. Les formats prioritaires sont Excel et PDF. Word peut être ajouté si certains canevas narratifs bailleurs l'exigent.

### 39. Les bailleurs demandent-ils des rapports différents de ceux utilisés en interne par le MJL ?

Hypothèse POC : oui. Le système doit permettre des rapports internes MJL et des rapports par bailleur/convention. Les formats exacts UNICEF et Redevabilité restent à collecter.

### 40. Le logiciel doit-il produire un tableau de bord avec des indicateurs synthétiques ?

Oui. Le POC inclut déjà un tableau de bord simple en lecture seule. La version suivante doit l'enrichir avec des indicateurs par projet, bailleur, convention et statut de dépense.

### 41. Quels indicateurs sont les plus importants pour la DPAF ?

Les indicateurs prioritaires sont :

- budget total ;
- fonds reçus ;
- dépenses validées ;
- dépenses soumises/en attente ;
- solde disponible ;
- taux d'exécution ;
- dépenses par projet ;
- dépenses par bailleur ;
- dépenses par activité ;
- alertes de dépassement budgétaire ;
- dépenses avec pièce manquante.

## H. Sécurité, hébergement et maintenance

### 42. Existe-t-il des contraintes imposées par le ministère concernant l'hébergement des données ?

Hypothèse POC : oui, des contraintes d'hébergement, de souveraineté, d'accès et de sauvegarde doivent être validées par le ministère. À défaut de directive contraire, il faut privilégier un hébergement contrôlé par le MJL ou par une infrastructure validée par l'État.

### 43. Quelle politique de sauvegarde souhaitez-vous : quotidienne, hebdomadaire, mensuelle ?

Réponse proposée : sauvegarde quotidienne de la base de données et des documents, avec rétention hebdomadaire et mensuelle. Les sauvegardes doivent être testées régulièrement par restauration.

### 44. Qui sera responsable de la maintenance après installation ?

Hypothèse POC : la maintenance fonctionnelle doit être portée par une équipe référente MJL/DPAF, avec appui technique du prestataire pendant la phase de stabilisation. La maintenance applicative et serveur doit être clarifiée entre le prestataire, la DSI et l'hébergeur.

### 45. Pendant combien de temps le prestataire devra-t-il assurer l'assistance technique ?

Réponse proposée : prévoir au minimum 3 mois d'assistance post-installation pour la stabilisation, puis une option de maintenance de 12 mois incluant corrections, support utilisateur, sauvegardes, petites évolutions et accompagnement des rapports.

## Points à confirmer avec le client

- Le référentiel comptable officiel attendu : SYSCOHADA, SYCEBNL, comptabilité publique ou combinaison.
- Les canevas UNICEF, HACT, FACE et Redevabilité à reproduire.
- Les règles exactes de validation, correction, rejet et annulation.
- La politique de dépassement budgétaire : blocage strict ou alerte avec dérogation.
- La liste officielle des profils utilisateurs et des droits DPAF/DPJJE.
- Les contraintes d'hébergement, de sauvegarde et de conservation des pièces justificatives.

## Questions complémentaires sur le choix de Dolibarr

### 46. Est-ce que l'outil gère les fichiers et pièces justificatives ?

Oui. Dolibarr dispose déjà d'une gestion documentaire via son module Documents/ECM. Le POC MJL s'appuie sur ce principe pour rattacher des pièces aux fonds reçus et aux dépenses : avis de crédit, factures, bons de commande, ordres de mission, états de perdiem ou autres justificatifs.

Dans l'état actuel du POC, les pièces justificatives sont représentées dans les données d'exemple et des fichiers placeholders existent. Le socle technique est donc validé. La prochaine étape consiste à ajouter des écrans utilisateurs complets pour téléverser, consulter, remplacer et contrôler ces pièces directement depuis les fiches dépenses, conventions ou fonds reçus.

Réponse client proposée : oui, la gestion des fichiers est possible et cohérente avec le besoin MJL. Elle doit être finalisée dans l'interface métier afin que chaque dépense ou financement soit accompagné de ses justificatifs et que les pièces manquantes soient signalées.

### 47. Peut-on facilement ajouter d'autres types d'utilisateurs et gérer les permissions par rôle ?

Oui. Dolibarr gère nativement les utilisateurs, groupes et droits d'accès. Le module MJL ajoute déjà des droits spécifiques pour les conventions, activités, lignes budgétaires, fonds reçus, dépenses, validations, rapports et exports.

Le POC contient déjà plusieurs profils : administrateur POC, comptable projet, responsable projet, validateur financier et lecteur/audit. Cela montre que l'on peut séparer les droits de saisie, validation, consultation, administration et reporting.

Réponse client proposée : oui, il est possible d'ajouter de nouveaux profils comme agent DPAF, agent DPJJE, contrôleur interne, auditeur, point focal bailleur ou administrateur technique. Il faudra simplement définir pour chaque rôle les actions autorisées : consulter, créer, modifier, valider, rejeter, exporter, administrer ou auditer.

### 48. Peut-on générer des rapports à partir des données ?

Oui. Les données du POC sont structurées pour permettre la génération de rapports par projet, bailleur, convention, activité, ligne budgétaire, dépense, statut et période. Le module contient déjà des définitions de rapports fixes, notamment :

- synthèse financière par projet ;
- exécution budgétaire par convention ;
- liste des dépenses avec pièces justificatives.

Dans l'état actuel du POC, le tableau de bord affiche déjà des synthèses en lecture seule. Les exports complets Excel/PDF et les modèles spécifiques bailleurs restent à développer.

Réponse client proposée : oui, Dolibarr et le module MJL permettent de produire des rapports à partir des données enregistrées. Pour la première version, il est recommandé de commencer avec des rapports fixes validés par la DPAF et les bailleurs, puis d'ajouter progressivement des exports plus avancés ou des canevas spécifiques comme UNICEF, FACE, HACT ou Redevabilité.

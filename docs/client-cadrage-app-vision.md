# Vision fonctionnelle cible de l'application MJL

## Support de cadrage client

Ce document sert de support à la réunion de cadrage entre le Ministère de la Justice et de la Législation et l'équipe de réalisation. Il présente une vision fonctionnelle cible destinée à aligner les parties prenantes sur les usages, les parcours, les responsabilités, les contrôles et les résultats attendus. Il ne constitue ni un rapport technique ni un état d'achèvement de la solution.

Les mentions « à confirmer », « à cadrer » et « à valider avec MJL » signalent les décisions attendues pendant la réunion. Elles permettent de distinguer les orientations proposées des règles qui devront être formellement approuvées.

## 1. Objectif de la solution

La vision cible est celle d'un espace de travail partagé pour le suivi financier et opérationnel des projets financés avec l'appui de Partenaires / Programmes. La solution doit permettre de:

- centraliser le suivi des projets et de leurs enveloppes de financement;
- donner une visibilité commune sur les budgets, les fonds reçus, les activités, les dépenses, les pièces justificatives et les validations;
- améliorer le pilotage financier et le suivi de l'exécution physique;
- faciliter les rapports internes et les échanges de redevabilité avec les partenaires techniques et financiers (PTF);
- renforcer la traçabilité des décisions, des corrections, des documents et des opérations;
- permettre à l'Agent de saisie, à l'Agent vérificateur et prévalidateur, au Validateur définitif et à l'Administrateur plateforme de travailler à partir d'une référence partagée, selon leurs habilitations.

La solution n'est pas positionnée comme un remplacement du système officiel de comptabilité publique ou de finances publiques. Toute évolution de ce positionnement devra faire l'objet d'une décision explicite pendant le cadrage.

## 2. Positionnement par rapport au système existant

Le système actuellement utilisé par MJL pour sa chaîne comptable et financière doit être confirmé. Il peut s'agir de CIG FP, SIGFP, SIGFiP ou d'un autre outil. Par défaut, l'application MJL cible complète ce dispositif par un suivi orienté projets, Partenaires / Programmes, financements, justificatifs, validations, tableaux de bord, rapports et audit.

Le cadrage doit déterminer si la coexistence repose uniquement sur des références communes ou si des échanges de données sont nécessaires. Aucune intégration avec un système existant n'est présumée.

| Sujet                                             | Système existant | Application MJL cible                                     | Point à clarifier                            |
| ------------------------------------------------- | ---------------- | --------------------------------------------------------- | -------------------------------------------- |
| Comptabilité officielle                           | À confirmer      | Non remplacée par défaut                                  | Le périmètre exact du système existant       |
| Suivi projet/PTF                                  | À confirmer      | Suivi détaillé par projet, partenaire, activité et budget | Le niveau de détail attendu                  |
| Conventions et financements                       | À confirmer      | Centralisation des enveloppes et fonds reçus              | Les références obligatoires                  |
| Dépenses projet                                   | À confirmer      | Suivi fonctionnel, pièces et validation                   | Le lien avec la chaîne comptable             |
| Engagement, liquidation, ordonnancement, paiement | À confirmer      | À cadrer si requis                                        | Le niveau de détail attendu dans le parcours |
| Pièces justificatives                             | À confirmer      | Rattachement, consultation et audit                       | Les pièces obligatoires par cas              |
| Rapports internes                                 | À confirmer      | Tableaux de bord et exports de suivi                      | Les indicateurs prioritaires                 |
| Rapports partenaires/PTF                          | À confirmer      | Canevas à reproduire si fournis                           | Les formats officiels attendus               |
| Références CIG FP/SIGFP                           | À confirmer      | Champs de référence possibles                             | Les codes et identifiants à conserver        |
| Imports/exports                                   | À confirmer      | Exports CSV/XLSX compatibles avec Excel proposés          | Les formats d'échange attendus               |

## 3. Vue d'ensemble du parcours cible

Le parcours cible proposé couvre la chaîne fonctionnelle suivante:

1. Identifier ou créer un Partenaire / Programme.
2. Créer ou suivre un projet.
3. Rattacher une convention ou une enveloppe de financement.
4. Définir les activités et les lignes budgétaires.
5. Enregistrer les fonds reçus.
6. Saisir une dépense.
7. Ajouter les pièces justificatives.
8. Soumettre la dépense pour prévalidation.
9. Prévalider, demander une correction, valider définitivement ou rejeter selon l'étape et le rôle autorisé.
10. Corriger et soumettre à nouveau lorsque cela est demandé.
11. Suivre l'exécution budgétaire, financière et physique, puis enregistrer séparément le décaissement lorsqu'il a réellement eu lieu.
12. Consulter les alertes et produire les rapports ou exports nécessaires.
13. Consulter l'historique, les documents, les commentaires et les traces d'audit.

Ce parcours doit rester lisible pour chaque rôle. Chaque utilisateur voit les données correspondant à ses Partenaires / Programmes autorisés, tandis que l'Administrateur plateforme dispose de la visibilité nécessaire à l'administration et au contrôle des accès.

## 4. Présentation par rôle utilisateur

Le modèle cible comprend exactement trois rôles métier et un rôle d'administration. Un utilisateur possède un seul rôle global et peut être rattaché à un ou plusieurs Partenaires / Programmes.

### 4.1 Agent de saisie

- **Mission dans l'application:** enregistrer et tenir à jour les informations opérationnelles relevant de son périmètre.
- **Capacités principales:** créer et corriger les activités et dépenses autorisées, renseigner l'exécution physique, joindre les pièces justificatives et soumettre les dossiers.
- **Informations consultées:** projets, enveloppes, lignes budgétaires, fonds reçus, activités, dépenses, statuts, motifs de correction et documents de son périmètre.
- **Actions ou décisions possibles:** enregistrer un brouillon, compléter un dossier, soumettre, corriger puis soumettre à nouveau.
- **Bénéfices attendus:** réduction des suivis dispersés, meilleure qualité des dossiers et visibilité immédiate sur les actions attendues.

### 4.2 Agent vérificateur et prévalidateur

- **Mission dans l'application:** effectuer un contrôle indépendant des activités et dépenses soumises.
- **Capacités principales:** vérifier la cohérence des informations et des pièces, demander une correction, prévalider ou rejeter lorsque la règle approuvée le permet.
- **Informations consultées:** données du dossier, rattachements budgétaires, justificatifs, historique, commentaires, alertes et informations de contrôle.
- **Actions ou décisions possibles:** prévalider, retourner pour correction, motiver une décision et suivre la nouvelle soumission.
- **Bénéfices attendus:** contrôle homogène, séparation des responsabilités et traçabilité de chaque décision intermédiaire.

### 4.3 Validateur définitif

- **Mission dans l'application:** prendre la décision métier finale et assurer la supervision financière dans son périmètre.
- **Capacités principales:** valider définitivement ou rejeter, superviser les financements, créer ou modifier les projets autorisés et enregistrer séparément le décaissement.
- **Informations consultées:** synthèses projet, budgets, fonds reçus, montants soumis et prévalidés, pièces, décisions antérieures, alertes et indicateurs.
- **Actions ou décisions possibles:** validation définitive, rejet motivé, décisions de supervision et constat du décaissement lorsque le mouvement de fonds a eu lieu.
- **Bénéfices attendus:** décisions mieux étayées, vision consolidée et distinction claire entre approbation métier et mouvement financier.

### 4.4 Administrateur plateforme

- **Mission dans l'application:** administrer la plateforme, les utilisateurs et leurs périmètres d'accès.
- **Capacités principales:** envoyer les invitations, gérer les comptes, attribuer les rôles, rattacher les Partenaires / Programmes et administrer les paramètres autorisés.
- **Informations consultées:** utilisateurs, rôles, périmètres, états d'accès et informations nécessaires à l'administration.
- **Actions ou décisions possibles:** activer ou désactiver un accès, modifier un rôle ou un périmètre et traiter les situations nécessitant une correction de rattachement.
- **Bénéfices attendus:** gouvernance claire des accès et maîtrise du périmètre visible par chaque utilisateur.

Le rôle d'Administrateur plateforme ne donne pas, à lui seul, le pouvoir de prévalidation ou de validation définitive. La consultation, le pilotage, l'audit et les rapports sont des capacités à répartir entre les trois rôles métier et l'Administrateur plateforme dans la matrice d'habilitation à valider avec MJL.

## 5. Parcours fonctionnels à présenter

### 5.1 Suivre un projet financé

- **Rôle principal:** Validateur définitif pour le pilotage, avec contribution de l'Agent de saisie.
- **Point de départ:** portefeuille des projets ou fiche d'un Partenaire / Programme.
- **Étapes du parcours:** sélectionner le projet, consulter son enveloppe, examiner les activités, budgets, fonds reçus, dépenses et alertes, puis ouvrir les éléments nécessitant une action.
- **Informations visibles:** identité du projet, période, financement, budget, progression physique, consommation financière, documents, décisions et risques.
- **Contrôles ou règles à confirmer:** droits de création et de modification, indicateurs prioritaires, fréquence de mise à jour et accès par périmètre.
- **Résultat attendu:** une vision partagée de l'état du projet et des prochaines décisions.

### 5.2 Enregistrer des fonds reçus

- **Rôle principal:** Validateur définitif, sous réserve de la matrice d'habilitation à valider avec MJL.
- **Point de départ:** enveloppe de financement ou espace Fonds reçus.
- **Étapes du parcours:** sélectionner l'enveloppe, renseigner la référence, la date, le montant et le statut de réception, ajouter le justificatif disponible, puis confirmer l'enregistrement.
- **Informations visibles:** Partenaire / Programme, projet éventuel, enveloppe, montant attendu, montant reçu, date et pièce associée.
- **Contrôles ou règles à confirmer:** rôle autorisé, informations obligatoires, gestion des réceptions partielles, devise, références externes et justificatif requis.
- **Résultat attendu:** fonds reçus identifiables, documentés et pris en compte dans le suivi financier.

### 5.3 Saisir et soumettre une dépense

- **Rôle principal:** Agent de saisie.
- **Point de départ:** projet, activité ou liste des dépenses.
- **Étapes du parcours:** créer la dépense, sélectionner l'enveloppe et la ligne budgétaire, renseigner le montant et le bénéficiaire, joindre les pièces, contrôler le dossier puis soumettre.
- **Informations visibles:** budget disponible, rattachements, montant, statut, pièces et informations requises avant soumission.
- **Contrôles ou règles à confirmer:** nomenclature, pièces obligatoires, seuil budgétaire, dates autorisées et informations du bénéficiaire.
- **Résultat attendu:** une dépense complète transmise au contrôle indépendant.

### 5.4 Valider ou rejeter une dépense

- **Rôle principal:** Agent vérificateur et prévalidateur, puis Validateur définitif.
- **Point de départ:** file des décisions attendues ou alerte de validation.
- **Étapes du parcours:** examiner les données et justificatifs, contrôler le budget, prévalider ou demander une correction, puis effectuer la validation définitive ou le rejet motivé.
- **Informations visibles:** dossier soumis, montant demandé, montant prévalidé, budget, pièces, historique, auteur et décisions antérieures.
- **Contrôles ou règles à confirmer:** niveaux de validation, motifs obligatoires, montants modifiables, délais de traitement et délégations éventuelles.
- **Résultat attendu:** une décision motivée, datée et attribuée au rôle compétent.

### 5.5 Corriger et soumettre à nouveau une dépense

- **Rôle principal:** Agent de saisie.
- **Point de départ:** alerte ou liste des dépenses à corriger.
- **Étapes du parcours:** consulter le motif, modifier les informations autorisées, remplacer ou compléter les pièces, expliquer la correction et soumettre à nouveau.
- **Informations visibles:** motif de retour, données précédentes, éléments modifiables, pièces et historique des décisions.
- **Contrôles ou règles à confirmer:** éléments verrouillés, délai de correction, nombre de retours et traitement d'une dépense abandonnée.
- **Résultat attendu:** un dossier corrigé qui conserve la trace du cycle précédent.

### 5.6 Consulter les tableaux de bord

- **Rôle principal:** chacun des trois rôles métier ainsi que l'Administrateur plateforme, avec une vue adaptée à ses responsabilités.
- **Point de départ:** tableau de bord de l'application.
- **Étapes du parcours:** choisir le périmètre et la période, consulter les indicateurs, examiner les alertes, puis accéder aux dossiers concernés.
- **Informations visibles:** activités en cours, validations attendues, budget, fonds reçus, dépenses, décaissements, progression et risques.
- **Contrôles ou règles à confirmer:** indicateurs visibles par rôle, définitions, seuils, périodes et fréquence d'actualisation.
- **Résultat attendu:** une compréhension rapide des priorités et des actions attendues.

### 5.7 Produire un rapport

- **Rôle principal:** Validateur définitif, avec droits complémentaires à confirmer pour l'Administrateur plateforme et les autres rôles.
- **Point de départ:** centre des rapports et exports.
- **Étapes du parcours:** choisir le rapport, définir le Partenaire / Programme, le projet, la période et les filtres, vérifier la sélection, puis générer le fichier CSV ou XLSX.
- **Informations visibles:** nom du rapport, périmètre, période, critères, colonnes prévues et format de sortie.
- **Contrôles ou règles à confirmer:** droits par rapport, canevas officiels, colonnes, ordre, fréquence et confidentialité.
- **Résultat attendu:** un fichier exploitable, cohérent avec le périmètre autorisé et traçable.

### 5.8 Auditer l'historique et les pièces justificatives

- **Rôle principal:** Agent vérificateur et prévalidateur ou Validateur définitif, selon la matrice à valider.
- **Point de départ:** fiche d'un projet, d'une activité, d'une dépense ou vue d'historique autorisée.
- **Étapes du parcours:** consulter les événements, identifier les acteurs et motifs, ouvrir les justificatifs autorisés, rapprocher les décisions et relever les anomalies.
- **Informations visibles:** dates, rôles, changements de statut, commentaires, valeurs importantes, documents et générations de rapports.
- **Contrôles ou règles à confirmer:** période historique consultable, droits de consultation, durée de conservation et besoins d'export pour l'audit.
- **Résultat attendu:** une chaîne de preuve compréhensible pour le contrôle et la redevabilité.

## 6. Capacités fonctionnelles attendues

### 6.1 Gestion des Partenaires / Programmes

- **Objectif:** structurer le portefeuille selon les organismes et programmes qui financent ou accompagnent les projets.
- **Valeur utilisateur:** disposer d'un point d'entrée commun vers les projets, financements, budgets, activités, dépenses et documents rattachés.
- **Capacités cibles:** fiche de synthèse, portefeuille rattaché, filtres, indicateurs, alertes et périmètres d'accès.
- **Questions à confirmer pendant le cadrage:** informations de référence, responsables, catégories, statut et règles de création ou de modification.

### 6.2 Gestion des projets

- **Objectif:** suivre chaque projet depuis sa création jusqu'à sa clôture fonctionnelle.
- **Valeur utilisateur:** relier objectifs, financement, activités, dépenses, documents et décisions dans une vision unique.
- **Capacités cibles:** création et modification autorisées, fiche projet, période, statut, rattachement au Partenaire / Programme, commentaires et synthèses.
- **Questions à confirmer pendant le cadrage:** champs obligatoires, cycle de vie, responsables fonctionnels, projets pilotes et critères de clôture.

### 6.3 Gestion des conventions ou enveloppes de financement

- **Objectif:** représenter le cadre financier accordé à un projet ou à un Partenaire / Programme.
- **Valeur utilisateur:** connaître les montants, périodes, références et conditions qui encadrent l'exécution.
- **Capacités cibles:** création, activation, suivi, rattachement, montant, devise, dates, documents et historique.
- **Questions à confirmer pendant le cadrage:** terme officiel, références obligatoires, enveloppe globale ou par projet, avenants et règles de clôture.

### 6.4 Gestion des activités

- **Objectif:** suivre l'exécution opérationnelle des actions prévues par les projets.
- **Valeur utilisateur:** rapprocher l'avancement physique, les échéances, les dépenses, les pièces et les décisions.
- **Capacités cibles:** création, planification, responsable, avancement, soumission, prévalidation, validation définitive, correction et historique.
- **Questions à confirmer pendant le cadrage:** indicateurs physiques, règles de validation, activités obligatoires, dates et critères d'achèvement.

### 6.5 Gestion des lignes budgétaires

- **Objectif:** organiser les allocations et mesurer leur consommation.
- **Valeur utilisateur:** contrôler les dépenses par poste et anticiper les risques de dépassement.
- **Capacités cibles:** budget initial et révisé, statut, rattachement, dépenses soumises, prévalidées, validées définitivement, décaissées et solde.
- **Questions à confirmer pendant le cadrage:** nomenclature, codes comptables, révisions, transferts, activation et politique de fermeture.

### 6.6 Gestion des fonds reçus

- **Objectif:** tracer les réceptions de financement liées aux enveloppes.
- **Valeur utilisateur:** comparer les financements attendus, les montants reçus et les montants utilisés.
- **Capacités cibles:** référence, date, montant, statut reçu ou non reçu, projet éventuel, preuve et historique.
- **Questions à confirmer pendant le cadrage:** rôle responsable, réceptions partielles, pièces obligatoires, devises et références du système officiel.

### 6.7 Gestion des dépenses

- **Objectif:** enregistrer et suivre les dépenses de projet jusqu'à leur décision et leur décaissement éventuel.
- **Valeur utilisateur:** maîtriser les montants, les rattachements, les bénéficiaires, les justificatifs et les étapes de contrôle.
- **Capacités cibles:** brouillon, soumission, correction, prévalidation, validation définitive, rejet, décaissement distinct et historique.
- **Questions à confirmer pendant le cadrage:** typologie, champs obligatoires, règles de montant, dates, bénéficiaires et traitement des annulations.

### 6.8 Gestion des pièces justificatives

- **Objectif:** rattacher les preuves aux objets métier concernés et en contrôler l'accès.
- **Valeur utilisateur:** retrouver rapidement la pièce attendue et établir une chaîne de preuve fiable.
- **Capacités cibles:** ajout dans le contexte d'une activité, dépense, enveloppe ou réception de fonds, consultation centralisée, téléchargement contrôlé et traçabilité.
- **Questions à confirmer pendant le cadrage:** liste des pièces par cas, formats, taille, prévisualisation, remplacement, archivage et durée de conservation.

### 6.9 Workflow de validation

- **Objectif:** organiser des décisions successives, indépendantes et traçables.
- **Valeur utilisateur:** savoir qui doit agir, sur quel dossier et avec quelle conséquence.
- **Capacités cibles:** soumission, prévalidation, demande de correction, nouvelle soumission, validation définitive, rejet et décaissement séparé.
- **Questions à confirmer pendant le cadrage:** niveaux exacts, délégations, délais, motifs obligatoires et traitement des absences.

### 6.10 Tableaux de bord

- **Objectif:** rendre visibles les priorités, les résultats et les risques.
- **Valeur utilisateur:** passer d'une synthèse à l'élément qui nécessite une action.
- **Capacités cibles:** indicateurs par rôle, filtres par Partenaire / Programme, projet et période, files d'attente, alertes et accès aux détails.
- **Questions à confirmer pendant le cadrage:** indicateurs prioritaires, définitions, seuils, objectifs et visibilité par rôle.

### 6.11 Alertes

- **Objectif:** signaler les situations nécessitant une attention ou une décision.
- **Valeur utilisateur:** réduire les retards et les oublis, puis prioriser les contrôles.
- **Capacités cibles:** échéances proches ou dépassées, validations en attente, corrections demandées, pièces manquantes, risque budgétaire et dépenses validées non décaissées.
- **Questions à confirmer pendant le cadrage:** seuils, destinataires, niveau de gravité, délai de rappel et mode de traitement.

### 6.12 Rapports et exports

- **Objectif:** produire des données consolidées pour le pilotage et la redevabilité.
- **Valeur utilisateur:** analyser les résultats et partager des sorties cohérentes avec le périmètre autorisé.
- **Capacités cibles:** filtres, aperçu, exports CSV et XLSX, libellés français, traçabilité des générations et canevas partenaires validés.
- **Questions à confirmer pendant le cadrage:** rapports V1, formats officiels, colonnes, ordre, périodicité et droits de génération.

### 6.13 Historique, audit et traçabilité

- **Objectif:** conserver la mémoire des événements et des décisions importantes.
- **Valeur utilisateur:** expliquer le cheminement d'un dossier et identifier les acteurs, dates, motifs et changements.
- **Capacités cibles:** historique contextuel, décisions, changements de statut, commentaires, valeurs importantes, documents et exports.
- **Questions à confirmer pendant le cadrage:** période historique consultable, durée de conservation, visibilité, recherches nécessaires et exports pour l'audit.

### 6.14 Administration et droits d'accès

- **Objectif:** garantir que chaque utilisateur accède uniquement aux fonctions et données autorisées.
- **Valeur utilisateur:** protéger les informations tout en donnant à chacun un espace de travail adapté.
- **Capacités cibles:** invitation, gestion des comptes, attribution d'un rôle global, rattachement à un ou plusieurs Partenaires / Programmes et désactivation d'accès.
- **Questions à confirmer pendant le cadrage:** matrice détaillée des droits, responsables d'approbation des accès, fréquence de revue et traitement des changements d'affectation.

## 7. Contrôles métier à cadrer

Les contrôles suivants doivent être validés avec MJL avant de devenir des règles de référence:

- **Dépassement budgétaire:** confirmer s'il entraîne un blocage, une alerte ou une dérogation formellement autorisée.
- **Pièces obligatoires:** définir les justificatifs attendus par type de dépense, montant, activité ou Partenaire / Programme.
- **Niveaux de validation:** confirmer la prévalidation et la validation définitive, ainsi que toute condition complémentaire sans créer un nouveau rôle.
- **Nature des contrôles:** préciser les contrôles techniques, financiers ou hiérarchiques attendus à chaque étape.
- **Séparation des responsabilités:** interdire à un utilisateur de prévalider, valider définitivement ou enregistrer le décaissement de sa propre opération.
- **Correction et nouvelle soumission:** définir les données modifiables, les motifs obligatoires et les délais.
- **Annulation ou correction après validation:** cadrer le traitement d'une opération validée ou décaissée sans effacer son historique.
- **Périmètres d'accès:** confirmer les restrictions par Partenaire / Programme, projet et rôle.
- **Références externes:** définir les identifiants CIG FP, SIGFP, SIGFiP ou autres à conserver, le cas échéant.
- **Nomenclature:** valider les lignes budgétaires, codes comptables et catégories de dépenses.
- **Rapports officiels:** valider les modèles, colonnes, signatures éventuelles et règles de diffusion.
- **Archivage:** confirmer la durée de conservation, les responsabilités, les formats et les règles de consultation des pièces.

## 8. Rapports et indicateurs attendus

Le périmètre proposé couvre les familles suivantes:

- synthèse par projet;
- exécution budgétaire;
- suivi par convention ou enveloppe de financement;
- fonds reçus et fonds utilisés;
- dépenses par activité;
- dépenses par ligne budgétaire;
- montants soumis, prévalidés, validés définitivement et décaissés;
- dépenses en attente de prévalidation ou de validation définitive;
- dépenses rejetées ou à corriger;
- pièces justificatives manquantes;
- suivi des validations et des délais de traitement;
- progression physique des activités;
- alertes d'échéance et de risque budgétaire;
- exports pour analyse;
- rapports partenaires/PTF lorsque les canevas sont fournis.

Les indicateurs peuvent notamment comparer le budget initial, le budget révisé, les fonds reçus, les dépenses soumises, les montants prévalidés, les montants validés définitivement, les montants décaissés, le solde restant, le taux de validation et le taux d'exécution.

Les modèles exacts doivent être validés avec MJL, en particulier lorsqu'un Partenaire / Programme impose un format, une périodicité ou des colonnes spécifiques. Les sorties proposées sont des fichiers CSV ou XLSX lisibles dans Excel. Elles ne deviennent des canevas officiels qu'après validation explicite.

## 9. Questions structurantes pour la réunion de cadrage

- Quel est le nom exact du système actuellement utilisé: CIG FP, SIGFP, SIGFiP ou autre?
- Quelles opérations doivent obligatoirement rester dans ce système?
- La solution MJL doit-elle compléter ce système, remplacer certains fichiers Excel ou couvrir une partie du parcours actuel?
- Faut-il enregistrer des références CIG FP, SIGFP, SIGFiP ou autres dans la solution?
- Des imports ou exports avec le système existant sont-ils attendus, et sous quels formats?
- Les étapes d'engagement, liquidation, ordonnancement et paiement doivent-elles être représentées?
- Quels contrôles budgétaires sont obligatoires et quelles situations doivent être bloquées?
- Comment répartir précisément les droits entre Agent de saisie, Agent vérificateur et prévalidateur, Validateur définitif et Administrateur plateforme?
- Qui peut gérer les enveloppes de financement, les lignes budgétaires et les fonds reçus?
- Quels rapports et indicateurs sont indispensables pour la V1?
- Quels canevas partenaires/PTF doivent être reproduits?
- Quels projets pilotes doivent servir à la validation fonctionnelle?
- Quelles contraintes d'hébergement, de sauvegarde, d'archivage, de conservation et de sécurité doivent être respectées?
- Le suivi doit-il rester exclusivement en franc CFA (XOF) ou couvrir d'autres devises?

## 10. Proposition de périmètre V1

### Périmètre recommandé

- suivi des Partenaires / Programmes;
- suivi des projets;
- conventions ou enveloppes de financement;
- activités et lignes budgétaires;
- fonds reçus;
- dépenses et pièces justificatives;
- prévalidation, validation définitive, rejet, correction et nouvelle soumission;
- enregistrement distinct du décaissement;
- tableaux de bord;
- alertes principales;
- rapports et exports prioritaires en CSV et XLSX;
- trois rôles métier, un rôle d'administration et leurs droits;
- historique, commentaires et audit.

### Périmètre ultérieur ou exclu par défaut

- remplacement de la comptabilité publique officielle;
- intégration complète avec CIG FP, SIGFP ou SIGFiP;
- intégration bancaire;
- intégration avec les marchés publics;
- reconnaissance automatique de documents;
- portail externe pour les partenaires;
- application mobile complète ou fonctionnement hors connexion;
- constructeur dynamique avancé de rapports;
- exécution automatique des paiements;
- rapports PDF ou Word.

Tout transfert d'un élément vers la V1 doit être décidé pendant le cadrage avec ses impacts sur les données, les droits, les contrôles et le calendrier.

## 11. Structure proposée pour le futur support interactif HTML

Le futur support interactif pourra reprendre la structure suivante:

- une introduction avec la promesse du projet;
- une explication courte du positionnement cible;
- un sélecteur parmi les trois rôles métier et l'Administrateur plateforme;
- des cartes de parcours adaptées au rôle choisi;
- une représentation du parcours complet;
- une carte des capacités par domaine;
- un aperçu des tableaux de bord;
- un aperçu des rapports et indicateurs;
- un panneau des contrôles à valider;
- un panneau d'alignement avec CIG FP, SIGFP, SIGFiP ou le système confirmé;
- une présentation du périmètre V1 et des éléments ultérieurs;
- une liste des décisions attendues pendant la réunion;
- les prochaines étapes après validation du cadrage.

Cette future présentation devra faciliter la discussion et la prise de décision sans transformer les propositions en engagements non validés.

## 12. Synthèse finale

La vision cible de l'application MJL est celle d'un espace partagé donnant une visibilité fiable sur les projets financés, les enveloppes, les activités, les budgets, les fonds reçus, les dépenses, les pièces justificatives et les décisions. Elle vise à renforcer le pilotage, la traçabilité et la redevabilité tout en restant complémentaire au système officiel de comptabilité ou de finances publiques.

La réunion de cadrage doit confirmer la relation avec le système existant, la matrice détaillée des droits entre les trois rôles métier et l'Administrateur plateforme, les contrôles métier, les rapports prioritaires, les canevas partenaires et les contraintes d'exploitation. Une fois ces décisions validées, les priorités fonctionnelles et le futur support interactif pourront être alignés sur une vision commune.

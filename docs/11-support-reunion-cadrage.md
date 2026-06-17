# Support reunion de cadrage - POC Dolibarr MJL

Date de preparation : 15 juin 2026

## 1. Objectif de la reunion

Cette reunion est une reunion de cadrage. L'objectif n'est pas de valider une application finale, mais de transformer le TDR et le POC actuel en perimetre fonctionnel clair pour une premiere version utilisable.

Objectifs concrets de la seance :

- confirmer le probleme prioritaire a resoudre pour le MJL ;
- valider si Dolibarr est un socle acceptable pour le besoin ;
- presenter ce que le POC demontre deja ;
- identifier les ecarts entre le POC et l'application attendue ;
- obtenir les decisions de cadrage necessaires pour planifier la suite ;
- lister les documents metier a collecter apres la reunion.

Message a porter au client :

> Le POC montre que Dolibarr peut servir de base pour structurer le suivi financier des projets finances par des PTF. La reunion doit maintenant confirmer les workflows, les roles, les rapports et les regles de gestion avant de transformer le POC en application metier utilisable.

Ouverture conseillee, en 2 minutes :

> Nous avons travaille a partir du TDR pour preparer un POC sous Dolibarr. Ce POC n'est pas encore l'application finale, mais il permet de tester le modele cible : projets finances par des PTF, conventions, activites, lignes budgetaires, fonds recus, depenses, pieces justificatives, validations et rapports. Aujourd'hui, l'objectif est de confirmer avec vous les regles metier et les priorites pour transformer ce socle en premiere version utile.

## 2. Hypotheses de depart

Ces hypotheses sont faites a partir du TDR et du POC, en l'absence d'autres echanges client.

- Le besoin principal est le suivi financier et budgetaire des projets finances par des PTF, pas le remplacement complet de toute la comptabilite du ministere.
- Le ministere veut suivre la chaine complete : bailleur, projet, convention, activite, ligne budgetaire, fonds recus, depense, piece justificative, validation et rapport.
- Les utilisateurs prioritaires sont la DPAF, les responsables projets, les validateurs financiers, les profils consultation/audit et les administrateurs.
- Les rapports bailleurs et internes sont un livrable critique.
- Les fichiers Excel et canevas existants resteront une reference importante au debut.
- Les pieces justificatives doivent etre conservees et rattachees aux operations.
- Les regles exactes de validation, correction, rejet, annulation et depassement budgetaire doivent etre confirmees avec le client.
- Le POC ne couvre pas encore les contraintes completes d'hebergement, sauvegarde, exploitation, maintenance et securite ministerielle.

## 3. Resume executif du POC actuel

Le depot contient une instance Dolibarr 23.0.2 dockerisee et un module specifique `mjlfinancement`.

Le POC demontre deja :

- un modele de donnees metier pour conventions, activites, lignes budgetaires, receptions de fonds, depenses, validations et rapports ;
- des profils utilisateurs et droits d'acces separes ;
- un tableau de bord MJL ;
- un tableau de bord DPAF dedie ;
- des listes de consultation pour conventions, lignes budgetaires, fonds recus et validations ;
- un workflow activite trace dans l'historique workflow ;
- un journal d'echanges rattache aux activites ;
- un workflow depense plus avance : creation, upload de piece, soumission, validation, rejet, correction, resoumission ;
- des rapports fixes avec filtres et export CSV Excel-compatible ;
- des scripts de bootstrap, chargement de donnees exemple et verification technique ;
- un jeu de donnees representatif avec projets, bailleurs, conventions, lignes budgetaires, depenses et cas limites.

Limite importante a expliquer clairement :

> Le POC est une preuve de faisabilite technique et fonctionnelle. Il n'est pas encore une application finale prete pour tous les utilisateurs. Les prochains travaux doivent surtout professionnaliser l'interface, les formulaires, les rapports officiels, les controles metier et l'exploitation.

## 4. Parcours de demonstration conseille

### 4.1 Acces local

Demarrer l'environnement :

```bash
docker compose up -d
```

Adresse :

```text
http://127.0.0.1:8080/
```

Preparation du POC :

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
```

Mot de passe POC par defaut :

```text
MjlPoc2026!!
```

Utilisateurs exemples :

- `admin.poc` : administration POC ;
- `agent.mjl` : saisie et soumission ;
- `superviseur.n1` : validation/rejet de premier niveau ;
- `superviseur.n2` : validation/rejet de deuxieme niveau ;
- `dpaf.mjl` : tableau de bord, consultation et exports ;
- `lecteur.audit` : consultation/audit.

### 4.2 Scenario de demo

1. Se connecter comme `admin.poc` ou `agent.mjl`.
2. Ouvrir le menu MJL Financement.
3. Montrer le tableau de bord : volumes, synthese projet, execution budgetaire.
4. Montrer les conventions et lignes budgetaires.
5. Montrer les fonds recus.
6. Ouvrir les depenses.
7. Creer ou montrer une depense brouillon.
8. Ajouter une piece justificative.
9. Soumettre la depense.
10. Se connecter comme `superviseur.n1`.
11. Valider une depense conforme.
12. Rejeter une depense avec motif.
13. Montrer l'historique des validations.
14. Ouvrir les rapports et exporter un CSV.

Point d'attention pendant la demo :

- Certains ecrans utilisent encore des identifiants numeriques au lieu de listes deroulantes conviviales.
- Les rapports sont fixes, pas encore des canevas officiels bailleurs.
- La gestion documentaire est presente, mais doit etre amelioree pour consultation, telechargement et controle utilisateur.

## 5. Perimetre fonctionnel a valider

### 5.1 Objets metier

Le POC propose les objets suivants :

- PTF / bailleur ;
- projet ;
- convention ;
- activite ;
- ligne budgetaire ;
- reception de fonds ;
- depense ;
- piece justificative ;
- validation ;
- rapport.

Questions a poser :

- Ces objets correspondent-ils a votre realite metier ?
- Faut-il ajouter des objets comme service beneficiaire, direction, programme, source de financement, type de piece, engagement, liquidation ou paiement ?
- La notion d'activite est-elle obligatoire pour toutes les depenses ?
- Une convention peut-elle financer plusieurs projets ou un projet peut-il recevoir plusieurs conventions ?

### 5.2 Workflow depense

Workflow propose :

1. Brouillon.
2. Soumis.
3. Valide.
4. Rejete.
5. Corrige.
6. Resoumis.

Questions a poser :

- Qui cree une depense ?
- Qui peut la soumettre ?
- Qui peut la valider ?
- Faut-il un seul niveau de validation ou plusieurs niveaux ?
- Faut-il distinguer validation technique, validation financiere et validation hierarchique ?
- Que doit-il se passer en cas de depassement budgetaire : blocage strict, alerte, derogation ?
- Une depense validee peut-elle etre annulee ? Si oui, selon quelle procedure ?

### 5.3 Pieces justificatives

Le POC exige une piece pour valider une depense.

Questions a poser :

- Quelles pieces sont obligatoires par type de depense ?
- Faut-il plusieurs pieces par depense ?
- Faut-il controler le type, la date, le montant ou la reference de chaque piece ?
- Quelle est la politique de conservation des pieces ?
- Qui peut consulter, remplacer ou supprimer une piece ?
- Les pieces doivent-elles etre exportees avec les rapports ?

### 5.4 Rapports et exports

Rapports deja prevus dans le POC :

- synthese financiere par projet ;
- execution budgetaire par convention ;
- liste des depenses avec pieces justificatives.

Questions a poser :

- Quels rapports sont obligatoires pour la premiere version ?
- Les rapports doivent-ils etre en Excel, PDF, Word ou CSV ?
- Existe-t-il des canevas UNICEF, FACE, HACT, Redevabilite ou autres a reproduire ?
- Quels filtres sont indispensables : projet, bailleur, convention, activite, periode, statut, categorie, direction ?
- Qui peut exporter les rapports ?
- Faut-il garder l'historique des rapports emis ?

## 6. Roles et droits a valider

Roles POC :

| Role | Capacite principale |
| --- | --- |
| Administrateur POC | configuration, utilisateurs, droits, toutes operations POC |
| Comptable projet | fonds recus, depenses, pieces, soumission, rapports |
| Responsable projet | consultation projet, conventions, budget, rapports |
| Validateur financier | validation ou rejet des depenses |
| Lecteur / audit | consultation et controle sans modification |

Questions a poser :

- Quels sont les vrais profils au MJL ?
- DPAF et DPJJE ont-elles les memes droits ?
- Y a-t-il des points focaux bailleurs ?
- Un auditeur externe doit-il acceder au systeme ?
- Les droits doivent-ils etre limites par projet, direction ou bailleur ?
- Qui administre les utilisateurs apres mise en production ?

## 7. Decisions attendues pendant la reunion

Priorite haute :

- Confirmer que la premiere version vise le suivi financier projet/PTF, pas une comptabilite complete.
- Valider les objets metier de base.
- Valider le workflow depense cible.
- Valider les roles utilisateurs principaux.
- Identifier les rapports obligatoires V1.
- Confirmer la regle de depassement budgetaire.
- Confirmer les exigences minimales sur les pieces justificatives.

Priorite moyenne :

- Confirmer les donnees de reference a importer.
- Confirmer les formats d'export attendus.
- Identifier les projets pilotes de demarrage.
- Identifier l'equipe qui validera les ecrans et les rapports.
- Confirmer les contraintes d'hebergement et de sauvegarde.

## 8. Ecarts POC vs application cible

| Sujet | Etat POC | A faire pour V1 |
| --- | --- | --- |
| Tableau de bord | Present, simple | Ajouter indicateurs valides par le client |
| Conventions | Liste lecture seule | Formulaires complets, detail, filtres |
| Activites | Modele donnees present | Ecran dedie et rattachement ergonomique |
| Lignes budgetaires | Liste lecture seule | CRUD complet, controles budgetaires |
| Fonds recus | Liste lecture seule | Saisie, piece, controle, detail |
| Depenses | Workflow avance mais interface simple | Selecteurs, detail, recherche, UX metier |
| Pieces justificatives | Upload depense present | Consultation, telechargement, multi-pieces, controles |
| Validations | Historique present | Workflow multi-niveaux si necessaire |
| Rapports | Rapports fixes + CSV | Canevas client, Excel/PDF, filtres metier |
| Droits | Base solide | Ajustement par profil reel et eventuellement par projet |
| API | Non specifique MJL | A definir seulement si integration requise |
| Tests navigateur | Non couverts | Ajouter tests end-to-end avant production |
| Exploitation | Docker local POC | Strategie serveur, sauvegarde, securite, maintenance |

## 9. Risques a cadrer tot

- Confusion entre suivi financier projet et comptabilite officielle complete.
- Absence de canevas officiels de rapports, qui peut bloquer les exports.
- Workflow de validation plus complexe que le POC si plusieurs directions interviennent.
- Droits d'acces potentiellement limites par projet, direction ou bailleur.
- Donnees existantes dispersees dans des fichiers Excel difficiles a reprendre.
- Contraintes d'hebergement ministeriel non encore clarifiees.
- Besoin de formation et d'accompagnement utilisateur sous-estime.

## 10. Documents a demander au client

- TDR final et annexes.
- Liste des projets pilotes.
- Liste des bailleurs/PTF et conventions en cours.
- Budgets par projet, convention, activite et ligne budgetaire.
- Modeles Excel actuels de suivi.
- Canevas de rapports bailleurs : UNICEF, FACE, HACT, Redevabilite ou autres.
- Procedure actuelle de depense et validation.
- Liste des profils utilisateurs et directions concernees.
- Exemples anonymises de pieces justificatives.
- Politique d'hebergement, sauvegarde et archivage si elle existe.

## 11. Proposition de cadrage V1

Perimetre V1 recommande :

- Gestion des bailleurs/PTF via tiers Dolibarr.
- Gestion projets et conventions.
- Gestion activites et lignes budgetaires.
- Enregistrement des fonds recus avec piece justificative.
- Saisie et soumission des depenses.
- Validation/rejet/correction des depenses.
- Rattachement obligatoire des pieces justificatives.
- Tableau de bord financier par projet/convention.
- Rapports fixes valides par le client.
- Export Excel/CSV, puis PDF si les canevas sont stabilises.
- Roles et droits : `AGENT`, `SUPERVISEUR_N1`, `SUPERVISEUR_N2`, `DPAF`, `ADMIN`, `LECTEUR`.

Hors perimetre V1 recommande :

- Remplacement complet de la comptabilite officielle.
- OCR ou lecture automatique des factures.
- Portail bailleur externe.
- Application mobile/offline complete.
- Integrations banque.
- Generateur dynamique de rapports.
- SMS ou notifications avancees.

## 12. Questions de conclusion a poser en fin de reunion

- Sommes-nous d'accord que la V1 doit prioriser le suivi projet/PTF et les rapports ?
- Quels sont les 2 ou 3 projets pilotes a integrer en premier ?
- Quel workflow de validation devons-nous formaliser ?
- Quels rapports doivent absolument sortir de la V1 ?
- Qui valide fonctionnellement les ecrans et les rapports cote MJL ?
- Quels documents pouvez-vous nous transmettre cette semaine ?
- Quelles contraintes d'hebergement devons-nous respecter ?

## 13. Suite proposee apres la reunion

1. Recevoir les documents metier du client.
2. Produire un compte rendu de cadrage avec decisions et points ouverts.
3. Transformer les decisions en backlog V1.
4. Maquetter ou adapter les ecrans prioritaires.
5. Implementer les workflows manquants.
6. Valider les rapports avec les vrais canevas.
7. Preparer une demonstration V1 sur donnees pilotes.

## 14. Positionnement a tenir

Formulation recommandee :

> Nous avons utilise le TDR pour construire un POC technique sous Dolibarr. Ce POC valide le socle : donnees, droits, workflow depense, pieces justificatives et rapports de base. La reunion de cadrage sert maintenant a confirmer les regles metier exactes et a prioriser la V1. Nous devons eviter de surcharger la premiere version avec toute la comptabilite, les integrations et les rapports dynamiques tant que les processus et canevas prioritaires ne sont pas valides.

## 15. Documents internes utiles

- `docs/07-actual-capabilities.md` : inventaire factuel de ce que le code sait faire aujourd'hui.
- `docs/09-client-questions-qa.md` : questions/reponses client preparees a partir des hypotheses POC.
- `docs/10-codebase-analysis.md` : analyse technique et fonctionnelle plus detaillee du depot.
- `mjl_dolibarr_poc_sample_data/TEST_SCENARIOS.md` : scenarios de test demonstrables.
- `README.md` : commandes de demarrage du POC.

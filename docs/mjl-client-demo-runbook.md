# Guide de demonstration client - MJL

Ce guide prepare une validation fonctionnelle client. Il ne vaut pas validation
de mise en production.

## Objectif de la demonstration

Valider avec le client que les parcours metier MJL couvrent le suivi des
financements, projets, activites, depenses, justificatifs, tableaux de bord,
exports CSV/XLSX, droits et traces d'audit.

## Preparation avant la demonstration

- Demarrer la pile locale Docker.
- Executer le bootstrap et le jeu de donnees local/dev.
- Confirmer que les comptes de demonstration se connectent.
- Ouvrir des sessions separees pour chaque role.
- Preparer un dossier de telechargement propre pour les exports.
- Garder visibles les documents Phase 14 de decision et de prise de notes.
- Rappeler que la demonstration ne ferme pas les sujets SMTP, URL publique,
  secrets, sauvegarde/restauration, monitoring ou hebergement final.

## Comptes de demonstration

- `ADMIN_PLATEFORME`: invitations, affectations, scopes, diagnostics.
- `AGENT_SAISIE`: saisie activite, depense, justificatif et execution
  physique.
- `AGENT_VERIFICATEUR`: prevalidation activites et depenses.
- `VALIDATEUR_DEFINITIF`: validation definitive, decaissement, gouvernance
  projet/financement.

Utiliser les comptes fixture locaux uniquement. Ne pas presenter les noms de
connexion fixture comme noms utilisateurs definitifs.

## Donnees de demonstration

- UNICEF.
- Programme Redevabilite.
- Enveloppe de financement.
- Fonds recus et preuve.
- Projet.
- Ligne budgetaire.
- Activite.
- Depense.
- Justificatif.
- Tableau de bord.
- Export CSV/XLSX.
- Historique/timeline.

## Scenario principal - UNICEF

1. UNICEF donne un financement.
2. MJL enregistre l'enveloppe de financement.
3. MJL enregistre les fonds recus.
4. MJL cree un projet.
5. MJL alloue le budget.
6. Agent de saisie cree une activite.
7. Agent de saisie soumet l'activite.
8. Agent verificateur / prevalidateur pre-valide.
9. Validateur definitif valide definitivement.
10. Agent met a jour l'execution physique.
11. Agent cree une depense avec justificatif.
12. Agent soumet la depense.
13. Agent verificateur / prevalidateur pre-valide.
14. Validateur definitif valide definitivement.
15. Validateur definitif marque la depense comme decaissee.
16. Le tableau de bord se met a jour.
17. Un export CSV/XLSX est genere.
18. L'historique/timeline prouve la tracabilite.

## Scenario d'isolation - Programme Redevabilite

1. Un utilisateur affecte seulement a Programme Redevabilite ouvre son espace.
2. Il ne voit pas les objets UNICEF.
3. Un utilisateur affecte seulement a UNICEF ne voit pas les objets Programme
   Redevabilite.
4. Admin plateforme voit les deux perimetres.
5. Les tentatives par URL directe ou filtre non autorise echouent ferme ou
   retournent des resultats vides.

## Deroule detaille

- Commencer par le tableau de bord pour situer le role connecte.
- Montrer Partenaires / Programmes et le perimetre actif.
- Suivre le parcours UNICEF de financement vers activite et depense.
- Changer de role au moment des prevalidations et validations definitives.
- Montrer que l'auto-prevalidation, l'auto-validation definitive et
  l'auto-decaissement ne sont pas la regle.
- Montrer les justificatifs par routes MJL gardees.
- Terminer par les KPI, exports et traces d'historique.

## Exports a produire pendant la demonstration

- Un export CSV de suivi activites ou execution financiere.
- Un export XLSX de depenses/decaissements ou historique decisions.
- Montrer les en-tetes francais, les filtres serveur, le nom de fichier stable
  et la limitation au perimetre autorise.

## Points a faire valider

- Matrice de permissions.
- Noms et libelles des roles.
- Perimetre par Partenaires / Programmes.
- Creation de projet par Admin / Validateur definitif.
- Libelles workflow activite et depense.
- Difference entre `Valide definitivement` et `Decaisse`.
- Formules d'execution physique et financiere.
- KPI et tableaux de bord.
- Seuils d'alertes.
- Rapports/export CSV/XLSX.
- Documents, uploads contextuels et telechargements gardes.
- Historique/timeline et audit.

## Questions a poser

- Les roles et permissions correspondent-ils a l'organisation cible ?
- Les libelles workflow sont-ils compréhensibles pour les equipes ?
- Les KPI et formules correspondent-ils aux pratiques de suivi ?
- Les colonnes et l'ordre des exports sont-ils acceptables ?
- Les alertes sont-elles utiles et au bon niveau de priorite ?
- Quels points doivent etre ajustes avant la validation finale ?

## Points a ne pas promettre

- Production SMTP.
- Final public URL.
- Production secrets.
- Backup/restore.
- Monitoring/log retention.
- PDF/Word reports.
- SMS.
- OCR.
- Bank API.
- Public partner portal.
- Offline mode.

## Que faire si une question depasse le perimetre

Noter la question dans le journal de decisions ou les demandes de changement,
la classer, puis repondre que le point sera traite dans la phase appropriee.
Ne pas promettre une fonctionnalite ou une date pendant la demonstration.

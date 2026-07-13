# Pack de validation client - MJL

Ce pack sert a valider les parcours metier MJL avec le client. Il ne vaut pas validation de mise en production.

Statut: `PENDING_CLIENT_VALIDATION`.

## Objectif de la validation

Confirmer que l'application MJL peut etre presentee au client pour valider les workflows, les droits, les tableaux de bord, les rapports et les regles metier.

## Perimetre valide

- Partenaires / Programmes.
- UNICEF et Programme Redevabilite.
- Projets MJL.
- Enveloppes de financement, fonds recus et budgets.
- Activites et execution physique.
- Depenses / Decaissements.
- Documents et justificatifs.
- Historique, decisions et commentaires.
- Alertes.
- Tableaux de bord et KPI.
- Rapports CSV/XLSX.

## Hors perimetre de cette validation

- PDF/Word reports.
- SMS.
- OCR.
- bank API.
- public partner portal.
- offline mode.
- production SMTP.
- production domain/base URL.
- production secrets.
- backup/restore.
- monitoring/log retention.

## Roles utilisateurs

- Agent de saisie: saisit les activites, depenses, justificatifs et execution physique sur son perimetre.
- Agent verificateur / prevalidateur: pre-valide les activites et depenses sans auto-validation.
- Validateur definitif: valide definitivement les activites et depenses, puis marque les depenses comme decaissees.
- Admin plateforme: administre les acces, les invitations, les roles et les Partenaires / Programmes.

## Regles d'acces par Partenaire / Programme

- Un utilisateur a un seul role metier global.
- Un utilisateur peut etre affecte a un ou plusieurs Partenaires / Programmes.
- Un non-admin ne voit que les donnees de ses Partenaires / Programmes affectes.
- Admin plateforme voit tous les perimetres.
- Les donnees sans perimetre resolu echouent ferme pour les non-admins.

## Parcours 1 - Gestion des Partenaires / Programmes

Verifier que UNICEF et Programme Redevabilite sont visibles selon le perimetre affecte, et que les indicateurs de portefeuille ne melangent pas les donnees.

## Parcours 2 - Creation et suivi de projet

Verifier qu'Admin plateforme et Validateur definitif peuvent creer/modifier un projet dans l'espace MJL, et qu'Agent de saisie / Agent verificateur ne le peuvent pas.

## Parcours 3 - Enveloppe de financement, fonds recus et budget

Verifier l'enveloppe de financement, les fonds recus, les preuves, l'allocation budgetaire, le budget alloue, le budget non alloue, le montant valide definitivement, le montant decaisse, le taux de validation financiere et le taux d'execution financiere.

## Parcours 4 - Activites et execution physique

Verifier la creation, soumission, prevalidation, validation definitive, mise a jour du pourcentage d'execution physique, rejet des pourcentages invalides, alertes de retard et mise a jour des KPI.

## Parcours 5 - Depenses / Decaissements

Verifier la creation de depense, l'ajout de justificatif, la soumission, la prevalidation, la validation definitive, puis le passage a Decaisse. Verifier que Valide definitivement et Decaisse restent deux etats separes.

## Parcours 6 - Documents et justificatifs

Verifier que les uploads sont contextuels, que la page Documents globale est en lecture seule, que les telechargements passent par les routes MJL gardees, et qu'un utilisateur hors perimetre ne peut pas telecharger.

## Parcours 7 - Historique, decisions et commentaires

Verifier que les decisions workflow, les commentaires contextuels, les evenements documentaires et les exports apparaissent dans l'historique/timeline attendu.

## Parcours 8 - Alertes

Verifier les alertes de retard, echeance proche, activites en attente, depenses sans justificatif, depenses validees non decaissees et seuils budgetaires.

## Parcours 9 - Tableaux de bord et KPI

Verifier que chaque role voit les files et indicateurs adaptes, que les filtres Partenaire / Programme et projet changent les valeurs, et qu'aucune donnee hors perimetre n'apparait.

## Parcours 10 - Rapports CSV/XLSX

Verifier les exports CSV et XLSX, les en-tetes francais, le separateur point-virgule, le BOM UTF-8, les noms de fichiers stables, les filtres serveur, les droits d'export et l'audit d'export.

## Points a valider par le client

- Matrice de permissions finale.
- Libelles des KPI de tableau de bord.
- Colonnes, ordre et libelles des rapports/exports.
- Libelles de workflow.
- Formule d'execution physique.
- Formule d'execution financiere.
- Seuils d'alerte.
- Canevas finaux des rapports officiels.

## Limites connues

- Les donnees locales contiennent des lignes historiques d'audit/workflow non resolues; elles restent invisibles aux non-admins quand le perimetre ne peut pas etre resolu.
- Certains noms techniques internes conservent des termes historiques pour compatibilite fixture/migration.
- Les modeles de rapports et permissions ne sont pas encore approuves par le client.

## Points reportes a la preparation de production

- SMTP de production.
- URL/base publique.
- Secrets de production.
- Sauvegarde/restauration.
- Monitoring et retention des logs.
- Procedure finale d'hebergement/deploiement.

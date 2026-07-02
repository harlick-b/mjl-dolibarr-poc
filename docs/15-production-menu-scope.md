# Perimetre des menus pour la production

## Objectif

Ce document recapitule les liens et pages Dolibarr/MJL a conserver, masquer,
restreindre ou arbitrer avant une mise en production.

Conclusion importante : la navigation MJL est maintenant beaucoup plus fermee
autour du module custom. Le POC fonctionne avec un menu principal MJL groupe,
mais les arbitrages de production, le wording final et les sorties officielles
client restent a valider.

L'objectif production est une navigation d'abord MJL : les utilisateurs doivent
travailler dans les ecrans MJL, pas dans les menus ERP generiques de Dolibarr.

## Constats d'audit runtime

Les constats ci-dessous viennent d'une verification dans l'application lancee
localement, avec les profils POC `agent.mjl`, `superviseur.n1`, `dpaf.mjl`,
`lecteur.audit` et `admin.poc`.

| Constat | Impact |
| --- | --- |
| Les menus natifs `Tiers`, `Projets`, `Documents` et `Outils` sont caches dans l'espace MJL. | Les utilisateurs passent par les pages MJL, pas par les ecrans ERP generiques. |
| Les URL directes natives hors perimetre sont bloquees ou redirigees pour les profils MJL non-admin. | La securite ne repose pas seulement sur le masquage CSS. |
| `Facturation`, `Paiement`, `Banques` et `Comptabilite` apparaissent dans la coque de menu native, meme lorsque certaines pages sont refusees en acces direct. | Le client peut croire que ces fonctions font partie de la V1 alors qu'elles ne sont pas dans le perimetre actuel. |
| Des modules POC sont actives alors qu'ils ne sont pas des fonctionnalites MJL V1 : `ACCOUNTING`, `BANQUE`, `FACTURE`, `TAX`, `API`, `MODULEBUILDER`. | Il faut distinguer les modules utiles au POC technique des modules a exposer en production. |

## Pages MJL a garder visibles

Ces pages correspondent au perimetre MJL actuel et doivent rester les entrees
principales de l'application, selon le role de l'utilisateur.

| Page | Decision production |
| --- | --- |
| Tableau de bord MJL | Garder visible pour les utilisateurs MJL autorises. C'est l'entree principale. |
| Projets MJL | Garder visible. C'est le wrapper MJL sur les projets natifs, avec detail et notes/commentaires. |
| Activites | Garder visible. C'est un parcours coeur : creation, suivi, validation, correction, documents et historique. |
| Depenses | Garder visible. C'est un parcours coeur : saisie, piece justificative, soumission, validation, rejet, correction et resoumission. |
| Documents MJL | Garder visible. C'est une bibliotheque en lecture seule avec telechargements controles. |
| Alertes | Garder visible dans les sections metier ou supervision. Les alertes guident les actions attendues et les risques. |
| Historique des validations | Garder visible sous Supervision pour validateurs, supervision, admin et consultation/audit selon droits. |
| Tableau DPAF | Garder visible pour DPAF/Admin seulement. |
| Exports MJL | Garder visible pour DPAF/Admin seulement, avec droits d'export. |
| Conventions | Garder visible pour DPAF/Admin comme ecran de gestion encadree. |
| Budgets / lignes budgetaires | Garder visible pour DPAF/Admin comme ecran de gestion encadree. |
| Fonds recus | Garder visible pour DPAF/Admin comme ecran de gestion encadree. |
| Invitations | Garder visible pour Admin seulement. |

## Pages MJL a masquer ou reserver

Ces surfaces peuvent rester utiles techniquement, mais ne doivent pas etre
presentees comme des fonctions metier normales.

| Page | Decision production |
| --- | --- |
| Preparation production / roadmap interne | Masquee par defaut avec `MJL_SHOW_INTERNAL_ROADMAP=0`; Admin uniquement quand le flag vaut `1`. |
| Historique / Audit technique | A reserver aux profils supervision, admin ou audit. Les utilisateurs metier doivent plutot voir les timelines contextuelles dans les activites et depenses. |
| Echanges | Route avancee gardee sous garde directe, mais retiree du menu, des liens rapides et du tableau de bord. |
| Route d'acceptation d'invitation | Ne doit pas apparaitre dans le menu. Elle reste accessible uniquement par lien d'invitation. |
| Route de telechargement document | Ne doit pas apparaitre dans le menu. Elle sert uniquement aux liens de telechargement controles depuis les pages MJL. |

## Menus natifs Dolibarr a clarifier

Le point cle : certains modules Dolibarr sont necessaires en arriere-plan, mais
leurs menus natifs ne doivent pas forcement etre visibles pour les utilisateurs
metier.

| Menu natif | Utilite pour MJL | Decision recommandee |
| --- | --- | --- |
| Tiers | Necessaire pour stocker les PTF/bailleurs. | Garder le module en arriere-plan. Ne pas exposer le menu natif aux utilisateurs MJL non-admin. |
| Projets | Necessaire pour rattacher conventions, activites, budgets, depenses et rapports. | Garder le module en arriere-plan. Exposer les projets uniquement via `/custom/mjlfinancement/projects.php` pour les utilisateurs MJL non-admin. |
| Documents / ECM | Necessaire pour stocker les pieces justificatives. | Garder le module. Ne pas en faire le parcours normal. Les documents doivent etre consultes depuis la bibliotheque MJL ou les fiches contextuelles. |
| Export natif | Utile techniquement derriere certains exports. | Ne pas exposer comme parcours normal. Les utilisateurs doivent passer par le centre d'exports MJL. |
| Facturation / Paiement | Non necessaire pour la V1 actuelle. | Masquer ou desactiver sauf decision client explicite d'ajouter factures/paiements. |
| Banques | Non necessaire pour la V1 actuelle. | Masquer ou desactiver sauf decision client explicite d'ajouter suivi bancaire ou rapprochement. |
| Comptabilite | Hors perimetre V1 actuelle. | Masquer aux utilisateurs metier. Ne conserver que si une phase comptable officielle est validee ou si une contrainte technique l'impose. |
| GRH | Hors perimetre. | Masquer ou desactiver pour les utilisateurs MJL. |
| Outils | Technique. | Admin/technique uniquement. Ne doit pas etre visible pour les utilisateurs metier. |
| ModuleBuilder | Technique POC/developpement. | Desactiver ou reserver strictement aux administrateurs techniques hors production. |
| API | Technique/integration. | Admin/technique uniquement ; activer seulement si une integration production est validee. |
| Tax / Charges | Hors parcours MJL V1. | Masquer ou desactiver sauf decision comptable explicite. |

## Strategie de correction

La correction doit se faire en plusieurs couches. Masquer un lien dans le menu
ne suffit pas si l'URL directe reste accessible.

1. Confirmer le perimetre metier final avec MJL.
2. Garder les modules de donnees necessaires en arriere-plan : `Tiers`,
   `Projets`, `Documents/ECM`, `Export`.
3. Retirer les menus natifs non utiles des profils metier, sans modifier les
   fichiers coeur Dolibarr.
4. Restreindre les acces directs aux pages natives hors perimetre.
5. Garder un acces technique Admin lorsque necessaire pour l'exploitation.
6. Verifier chaque role dans le navigateur avant de declarer la navigation
   production prete.

Les corrections doivent utiliser des droits, de la configuration, la navigation
du module MJL, un theme/hook documente ou des scripts de setup. Les fichiers
coeur Dolibarr ne doivent pas etre modifies.

## Checklist de validation avant production

| Controle | Resultat attendu |
| --- | --- |
| Un agent se connecte. | Il voit l'espace MJL et les pages utiles a son travail, pas les menus ERP generiques hors perimetre. |
| Un superviseur se connecte. | Il voit les files de validation, alertes, depenses/activites et historiques utiles, pas les menus techniques. |
| DPAF se connecte. | Il voit supervision, exports, conventions, budgets, fonds recus et audit avance selon droits. |
| Admin se connecte. | Il garde les acces d'administration, d'invitation et de configuration necessaires. |
| Un utilisateur non-admin tente une URL native hors perimetre. | L'acces est refuse ou redirige vers l'espace MJL. |
| Les documents sont televerses et telecharges depuis MJL. | L'utilisateur n'a pas besoin d'ouvrir le menu natif `Documents`. |
| Les exports officiels sont produits depuis MJL. | L'utilisateur n'a pas besoin du menu natif `Export`. |
| Les modules hors perimetre sont actifs ou visibles. | Chaque module actif est justifie, ou bien masque/desactive avant production. |

## Decision actuelle

La strategie recommandee est de conserver Dolibarr comme socle technique, mais
de rendre l'experience utilisateur beaucoup plus fermee autour du module MJL.

Avant production, la navigation doit etre consideree comme un chantier ouvert :
les parcours MJL sont solides, mais les menus natifs encore visibles ou
accessibles peuvent creer de la confusion et doivent etre nettoyes.

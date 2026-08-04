# Handoff visuel MJL pour support de cadrage Sites

## 1. Résumé d'autorité

La référence visuelle retenue est la génération canonique v3 enregistrée par `docs/design-system/README.md`. Les valeurs viennent de `docs/design-system/approved/v3/design-tokens/tokens.json` et `docs/design-system/approved/v3/design-tokens/semantic-tokens.json`. Les principes et composants viennent de `docs/design-system/approved/v3/DESIGN.md` et de son inventaire de composants. La feuille `custom/mjlfinancement/css/mjl_app.css.php` confirme l'adoption des principaux tokens v3 dans le shell actif, sans servir de source pour ses anciennes valeurs littérales.

Les documents de design non versionnés antérieurs à v3, la mémoire racine fondée sur les anciens styles, le chrome Dolibarr natif, les pages historiques et les expériences temporaires sont ignorés. La palette et la typographie v3 constituent la fondation canonique actuelle, tout en restant remplaçables après validation des futurs actifs de marque.

## 2. Identité visuelle à reprendre

- Une ambiance institutionnelle, sobre, calme et fiable, orientée vers le travail administratif plutôt que vers la promotion.
- Une hiérarchie navy forte sur des surfaces blanches et un fond gris très clair, avec le bleu d'action réservé aux liens, choix actifs et contrôles.
- Un rythme fondé sur une grille de 4 px, avec des regroupements aérés et une densité plus compacte dans les matrices.
- Des cartes à bordure fine, petit rayon et ombre discrète, sans effet flottant spectaculaire.
- Des boutons directs, libellés en français, avec une action principale bleue et une action secondaire blanche bordée.
- Des badges courts à rayon de 6 px, dont le texte porte toujours le sens indépendamment de la couleur.
- Des matrices et tableaux clairs, comparables ligne par ligne, avec en-têtes sobres, bordures visibles et cellules compactes.
- Des indicateurs limités aux informations utiles, avec une valeur forte, un libellé court et un contexte explicite.
- Des alertes persistantes à bordure latérale, formulées comme un point d'attention et une action attendue.
- Des repères de navigation discrets, fond bleu doux pour la sélection et focus bleu foncé clairement visible.

## 3. Tokens CSS à appliquer

```css
:root {
  --mjl-primary: #16324f;
  --mjl-primary-soft: #eaf3f8;
  --mjl-accent: #164f7a;
  --mjl-background: #f5f7f8;
  --mjl-surface: #ffffff;
  --mjl-surface-muted: #f5f7f8;
  --mjl-border: #8a969e;
  --mjl-text: #202529;
  --mjl-muted: #5c6870;
  --mjl-success: #17633a;
  --mjl-success-soft: #e8f5ec;
  --mjl-success-badge: #caface;
  --mjl-warning: #6b4900;
  --mjl-warning-soft: #fff4cc;
  --mjl-danger: #8a1c1c;
  --mjl-danger-soft: #fdecec;
  --mjl-info: #164f7a;
  --mjl-info-soft: #eaf3f8;

  --mjl-font-family: Inter, Arial, Helvetica, sans-serif;
  --mjl-font-size-xs: 12px;
  --mjl-font-size-sm: 14px;
  --mjl-font-size-base: 16px;
  --mjl-font-size-lg: 20px;
  --mjl-font-size-xl: 24px;
  --mjl-font-size-2xl: 32px;

  --mjl-radius-sm: 4px;
  --mjl-radius-md: 6px;
  --mjl-radius-lg: 8px;
  --mjl-radius-control: 10px;
  --mjl-radius-pill: 999px;

  --mjl-space-1: 4px;
  --mjl-space-2: 8px;
  --mjl-space-3: 12px;
  --mjl-space-4: 16px;
  --mjl-space-5: 20px;
  --mjl-space-6: 24px;
  --mjl-space-8: 32px;
  --mjl-space-10: 40px;

  --mjl-shadow-sm: 0 1px 4px rgba(22, 50, 79, 0.08);
  --mjl-shadow-md: 0 8px 24px rgba(22, 50, 79, 0.16);
  --mjl-shadow-lg: 0 8px 24px rgba(22, 50, 79, 0.16);
}
```

Utiliser `--mjl-font-size-sm` pour le texte courant dense et `--mjl-font-size-base` pour les contrôles tactiles ou les textes de cadrage importants. Le rayon `--mjl-radius-pill` est réservé aux vraies puces et pastilles.

## 4. Règles de composants pour le support de cadrage

### 4.1 Cartes de cadrage

- Fond `--mjl-surface`, bordure de 1 px en `--mjl-border`, rayon `--mjl-radius-md` et ombre `--mjl-shadow-sm`.
- Padding de `--mjl-space-5`, avec `--mjl-space-3` entre le titre et le contenu.
- Titre navy, gras, entre `--mjl-font-size-base` et `--mjl-font-size-lg` selon le niveau.
- Métadonnées en `--mjl-font-size-xs`, couleur `--mjl-muted`, avec libellé gras et valeur courte.
- Une carte porte une seule question, décision ou famille d'informations.

### 4.2 Matrice des rôles

- En-tête sur `--mjl-surface-muted`, texte `--mjl-primary`, gras et aligné avec les cellules.
- Cellules sur `--mjl-surface`, séparées par une bordure de 1 px, avec 8 à 12 px de padding et une hauteur cible de 40 à 48 px.
- `Oui`: badge succès avec texte explicite.
- `Non`: badge neutre, car une limite de rôle n'est pas une erreur.
- `Selon périmètre`: badge information avec rappel du périmètre concerné.
- `À confirmer`: badge avertissement signalant une décision de cadrage.
- Garder visibles la capacité, le rôle et la valeur. Sur petite largeur, autoriser le défilement horizontal ou transformer chaque ligne en carte libellée sans retirer ces trois informations.

### 4.3 Parcours financier

- Représenter chaque étape comme un bloc léger sur `--mjl-surface`, bordé et arrondi avec `--mjl-radius-md`.
- Une étape active ou développée utilise `--mjl-primary-soft` et une bordure de 2 px en `--mjl-accent`.
- Relier les étapes par un trait fin en `--mjl-border`, horizontal sur grand écran et vertical sur petite largeur.
- Afficher le rôle responsable dans un badge neutre ou information, avec son nom complet.
- Afficher une question de validation dans un panneau `--mjl-info-soft` avec texte `--mjl-info`. Une précaution utilise la paire avertissement.
- Distinguer visuellement et textuellement la validation définitive du décaissement.

### 4.4 Cartes d'ambiguïté

- Présenter les options comme des choix secondaires bordés, courts et comparables, jamais comme des boutons d'action applicative.
- `à décider`: fond `--mjl-warning-soft`, texte `--mjl-warning`.
- `validé`: fond `--mjl-success-soft`, texte `--mjl-success`.
- `à revoir`: fond `--mjl-danger-soft`, texte `--mjl-danger`.
- Utiliser un encadré d'avertissement pour les conséquences ou dépendances, avec une formulation factuelle et courte.
- Ne jamais utiliser la couleur seule. Conserver le libellé d'état et la question à résoudre.

### 4.5 Tableau de bord schématique

- Carte KPI sur surface blanche, bordure fine, rayon `--mjl-radius-md`, ombre `--mjl-shadow-sm` et padding `--mjl-space-5`.
- Libellé d'indicateur en `--mjl-font-size-xs`, gras, couleur `--mjl-muted`, avec un contexte court.
- Montant ou valeur en `--mjl-font-size-2xl`, gras et couleur `--mjl-primary`. Utiliser des chiffres tabulaires lorsque disponibles.
- Placer le statut sous forme de badge textuel près de la valeur, sans transformer toute la carte en couleur vive.
- Aperçu d'alerte sur surface blanche avec bordure gauche de 4 px utilisant la couleur sémantique et une phrase d'action attendue.
- Limiter les indicateurs à ceux qui aident à valider le cadrage. Éviter les graphiques décoratifs.

### 4.6 Rapports CSV/Excel

- Carte de rapport sur `--mjl-surface`, avec titre, objectif, périmètre et formats disponibles.
- Puce de filtre en forme de pastille sur `--mjl-surface-muted`, texte `--mjl-muted` et bordure `--mjl-border`.
- Badge d'export sur `--mjl-info-soft`, texte `--mjl-info`, avec les libellés exacts `CSV` ou `XLSX`.
- Employer la formulation `CSV et XLSX compatibles Excel` pour les rapports V1.
- Ne pas suggérer un canevas partenaire précis tant que ce canevas n'a pas été confirmé pendant le cadrage.

### 4.7 Checklist de décision

- Ligne de case à cocher sur `--mjl-surface`, séparée par une bordure et dotée d'une zone d'interaction d'au moins 44 px.
- Utiliser une case native, une étiquette visible et un focus de 2 px en `--mjl-accent`.
- Une ligne cochée utilise `--mjl-success-soft` avec un libellé de confirmation. Ne pas barrer le texte de la décision.
- Compteur de progression sous forme de badge navy ou information, par exemple `6 décisions sur 10`.
- Bouton d'impression de style secondaire, avec libellé explicite. Retirer ce contrôle du rendu imprimé.

## 5. Règles d'adaptation pour le cadrage

- Conserver l'impression d'un tableau d'atelier fait pour discuter, comparer et arrêter des décisions.
- Ne pas reproduire un écran complet de l'application, sa barre latérale ou son en-tête utilitaire.
- Employer les couleurs, cartes, badges, boutons et rythmes MJL avec retenue afin de créer de la familiarité sans copier l'application.
- Garder les textes courts, orientés vers la décision, le responsable, le périmètre et le point à confirmer.
- Donner la priorité à la validation des parcours et des limites de rôle, pas à la simulation de fonctionnalités.
- Nommer les rôles autorisés: Agent de saisie, Agent vérificateur et prévalidateur, Validateur définitif, Administrateur plateforme.
- Montrer clairement qu'un rôle peut agir selon son périmètre de Partenaires / Programmes, sans inventer une matrice détaillée de droits.
- Garder CIG FP, SIGFP et SIGFiP comme un point de décision à clarifier, sans suggérer leur remplacement.
- Garder les rapports V1 en CSV et XLSX compatibles Excel.

## 6. Ce qu'il faut éviter

- Ne pas utiliser les styles historiques comme identité MJL.
- Ne pas utiliser le chrome Dolibarr natif comme référence visuelle.
- Ne pas créer une page de présentation commerciale ou promotionnelle.
- Ne pas rendre la page prolixe. Une carte doit rester rapidement lisible.
- Ne pas créer de faux écrans applicatifs, fausses données dynamiques ou contrôles qui suggèrent une application active.
- Ne pas inclure d'affirmation sur l'avancement, la livraison ou la disponibilité technique.
- Ne pas présenter l'application MJL comme un remplacement de CIG FP, SIGFP ou SIGFiP.
- Ne pas mettre PDF ou Word en avant pour les rapports V1.
- Ne pas utiliser de tiret cadratin.
- Ne pas dépendre d'un framework CSS ou JavaScript. Le support doit rester compatible avec un HTML autonome, du CSS intégré et du JavaScript vanilla.

## 7. Notes d'inférence

- Les noms de variables imposés par ce handoff sont des alias Sites des tokens v3. `--mjl-primary-soft` reprend la surface sélectionnée et `--mjl-surface-muted` reprend la surface subtile.
- Les élévations restent des adaptations du shell existant et ne remplacent pas les tokens v3 autoritatifs.
- La matrice des rôles, les étapes du parcours financier, les cartes d'ambiguïté et la checklist sont propres au support de cadrage. Leurs formes sont dérivées des cartes, tableaux, badges, panneaux de décision et états sémantiques v3.
- Les correspondances `Oui`, `Non`, `Selon périmètre`, `À confirmer`, `à décider` et `à revoir` sont des adaptations sémantiques pour l'atelier. Elles ne définissent aucun droit applicatif ni aucune règle métier.
- Les actifs de marque futurs peuvent remplacer la palette, la typographie ou les icônes. Les noms sémantiques et les exigences de contraste doivent alors être conservés.

## 8. Paragraphe prêt à coller dans le prompt Sites

Applique l'identité visuelle MJL décrite dans ce handoff et utilise ses variables CSS comme source unique de couleurs, typographie, espacements, rayons et ombres. Garde le résultat sous la forme d'un tableau d'atelier de cadrage, familier pour les utilisateurs MJL sans copier exactement l'application ni simuler un écran actif. Préserve les quatre rôles validés et rends leurs limites visibles sans inventer de droits. Présente les rapports V1 en CSV et XLSX compatibles Excel. Conserve CIG FP, SIGFP et SIGFiP comme une ambiguïté à clarifier pendant le cadrage, sans suggérer leur remplacement.

## 9. Mini CSS utilitaire optionnel

```css
.mjl-card,
.mjl-kpi-card {
  box-sizing: border-box;
  background: var(--mjl-surface);
  border: 1px solid var(--mjl-border);
  border-radius: var(--mjl-radius-md);
  box-shadow: var(--mjl-shadow-sm);
  color: var(--mjl-text);
  font-family: var(--mjl-font-family);
  padding: var(--mjl-space-5);
}

.mjl-badge,
.mjl-status-success,
.mjl-status-warning,
.mjl-status-danger,
.mjl-status-neutral {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border: 1px solid var(--mjl-border);
  border-radius: var(--mjl-radius-md);
  color: var(--mjl-muted);
  font-family: var(--mjl-font-family);
  font-size: var(--mjl-font-size-xs);
  font-weight: 700;
  line-height: 1.2;
  padding: var(--mjl-space-1) var(--mjl-space-2);
}

.mjl-button-primary,
.mjl-button-secondary {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 1px solid var(--mjl-accent);
  border-radius: var(--mjl-radius-control);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  line-height: 1.25;
  padding: var(--mjl-space-2) var(--mjl-space-4);
  text-decoration: none;
}

.mjl-button-primary {
  background: var(--mjl-accent);
  color: var(--mjl-surface);
}

.mjl-button-secondary {
  background: var(--mjl-surface);
  color: var(--mjl-accent);
}

.mjl-kpi-card {
  display: grid;
  gap: var(--mjl-space-2);
  border-left: 4px solid var(--mjl-primary);
  min-height: 132px;
}

.mjl-status-success {
  background: var(--mjl-success-soft);
  border-color: var(--mjl-success);
  color: var(--mjl-success);
}

.mjl-status-warning {
  background: var(--mjl-warning-soft);
  border-color: var(--mjl-warning);
  color: var(--mjl-warning);
}

.mjl-status-danger {
  background: var(--mjl-danger-soft);
  border-color: var(--mjl-danger);
  color: var(--mjl-danger);
}

.mjl-status-neutral {
  background: var(--mjl-surface-muted);
  border-color: var(--mjl-muted);
  color: var(--mjl-muted);
}

.mjl-button-primary:focus-visible,
.mjl-button-secondary:focus-visible {
  outline: 2px solid var(--mjl-accent);
  outline-offset: var(--mjl-space-1);
}
```

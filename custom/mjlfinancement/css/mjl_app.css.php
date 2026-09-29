<?php
header('Content-Type: text/css; charset=UTF-8');
?>
#mainmenua_tools,
#mainmenua_companies,
#mainmenua_societe,
#mainmenua_project,
#mainmenua_projet,
#mainmenua_ecm,
#mainmenua_hrm,
#mainmenua_expensereport,
#mainmenua_billing,
#mainmenua_compta,
#mainmenua_bank,
#mainmenua_accountancy,
#mainmenua_modulebuilder,
#mainmenua_api,
a.tmenu[href^="/core/tools.php"],
a.tmenu[href^="/societe/"],
a.tmenu[href^="/comm/"],
a.tmenu[href^="/projet/"],
a.tmenu[href^="/ecm/"],
a.tmenu[href^="/hrm/"],
a.tmenu[href^="/holiday/"],
a.tmenu[href^="/expensereport/"],
a.tmenu[href^="/commande/"],
a.tmenu[href^="/fourn/"],
a.tmenu[href^="/compta/"],
a.tmenu[href^="/banque/"],
a.tmenu[href^="/accountancy/"],
a.tmenu[href^="/modulebuilder/"],
a.tmenu[href^="/api/"] {
	display: none !important;
}

.mjl-workspace,
.mjl-module-shell {
	--mjl-color-primary: #16324f;
	--mjl-color-action: #164f7a;
	--mjl-color-support: #7fb3d5;
	--mjl-color-text: #202529;
	--mjl-color-text-secondary: #34414a;
	--mjl-color-text-muted: #5c6870;
	--mjl-color-text-inverse: #ffffff;
	--mjl-color-overlay: #202529b8;
	--mjl-color-surface: #ffffff;
	--mjl-color-surface-subtle: #f5f7f8;
	--mjl-color-surface-disabled: #e3e8eb;
	--mjl-color-surface-selected: #eaf3f8;
	--mjl-color-border: #8a969e;
	--mjl-color-border-subtle: #c8d0d5;
	--mjl-color-border-strong: #5c6870;
	--mjl-color-danger: #8a1c1c;
	--mjl-color-danger-surface: #fdecec;
	--mjl-color-status-info: #164f7a;
	--mjl-color-status-info-surface: #eaf3f8;
	--mjl-color-status-success: #17633a;
	--mjl-color-status-success-surface: #e8f5ec;
	--mjl-color-status-success-badge-surface: #caface;
	--mjl-color-status-warning: #6b4900;
	--mjl-color-status-warning-surface: #fff4cc;
	--mjl-color-status-danger: #8a1c1c;
	--mjl-color-status-danger-surface: #fdecec;
	--mjl-focus-ring: #164f7a;
	--mjl-font-sans: Inter, Arial, Helvetica, sans-serif;
	--mjl-space-1: 4px;
	--mjl-space-2: 8px;
	--mjl-space-3: 12px;
	--mjl-space-4: 16px;
	--mjl-space-5: 20px;
	--mjl-space-6: 24px;
	--mjl-radius-control: 10px;
	--mjl-radius-card: 6px;
	--mjl-radius-panel: 8px;
	--mjl-radius-status-badge: 6px;
	--mjl-radius-pill: 999px;
	--mjl-shadow-card: 0 1px 4px rgba(22, 50, 79, 0.08);
	--mjl-shadow-panel: 0 8px 24px rgba(22, 50, 79, 0.16);
	--mjl-touch-target: 44px;
	--mjl-control-compact: 32px;
	--mjl-control-standard: 40px;
	--mjl-row-data: 40px;
	--mjl-row-interactive: 44px;
}

.mjl-workspace {
	color: var(--mjl-color-text);
	font-family: var(--mjl-font-sans);
}

.mjl-module-shell {
	--mjl-dolibarr-edge-correction: 7px;
	align-items: stretch;
	background: var(--mjl-color-surface-subtle);
	display: grid;
	grid-template-columns: 228px minmax(0, 1fr);
	margin-left: calc((100% - 100vw) / 2 - var(--mjl-dolibarr-edge-correction));
	min-height: 100vh;
	position: relative;
	width: 100vw;
}

.mjl-skip-link {
	background: var(--mjl-color-action);
	border-radius: var(--mjl-radius-control);
	color: var(--mjl-color-text-inverse);
	font-size: 14px;
	font-weight: 700;
	left: var(--mjl-space-3);
	padding: var(--mjl-space-3) var(--mjl-space-4);
	position: fixed;
	text-decoration: none;
	top: var(--mjl-space-3);
	transform: translateY(calc(-100% - var(--mjl-space-6)));
	z-index: 1000;
}

.mjl-skip-link:focus { transform: translateY(0); }

.mjl-module-content { min-width: 0; }
.mjl-module-main {
	box-sizing: border-box;
	margin: 0 auto;
	max-width: 1600px;
	min-width: 0;
	padding: 30px 36px 60px;
}
.mjl-module-main:focus { outline: 2px solid var(--mjl-focus-ring); outline-offset: var(--mjl-space-1); }
.mjl-navigation-trigger,
.mjl-navigation-backdrop,
.mjl-navigation-close { display: none; }

.mjl-module-sidebar {
	align-self: start;
	background: var(--mjl-color-surface);
	border-right: 1px solid var(--mjl-color-border-subtle);
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	padding: 24px 16px 16px;
	position: sticky;
	top: 0;
}
.mjl-sidebar-title {
	align-items: center;
	display: flex;
	gap: var(--mjl-space-3);
	margin-bottom: 30px;
	padding: 0 var(--mjl-space-2);
}
.mjl-brandmark {
	align-items: center;
	background: var(--mjl-color-primary);
	border-radius: var(--mjl-radius-control);
	color: var(--mjl-color-text-inverse);
	display: inline-flex;
	font-size: 20px;
	font-weight: 700;
	height: 42px;
	justify-content: center;
	width: 40px;
}
.mjl-sidebar-title strong { color: var(--mjl-color-primary); font-size: 20px; letter-spacing: .03em; }
.mjl-sidebar-nav { display: grid; gap: var(--mjl-space-1); }
.mjl-sidebar-group { min-width: 0; }
.mjl-sidebar-link {
	align-items: center;
	border: 1px solid transparent;
	border-radius: var(--mjl-radius-card);
	box-sizing: border-box;
	color: var(--mjl-color-text-secondary);
	display: flex;
	font-size: 14px;
	font-weight: 600;
	gap: var(--mjl-space-3);
	line-height: 1.25;
	min-height: var(--mjl-touch-target);
	padding: var(--mjl-space-2) var(--mjl-space-3);
	text-decoration: none;
}
.mjl-nav-icon { flex: 0 0 18px; height: 18px; width: 18px; }
.mjl-sidebar-link-active { background: var(--mjl-color-surface-selected); color: var(--mjl-color-action); }
.mjl-sidebar-children {
	border-left: 2px solid var(--mjl-color-border-subtle);
	display: grid;
	gap: var(--mjl-space-1);
	margin: var(--mjl-space-1) 0 var(--mjl-space-2) 21px;
	padding-left: var(--mjl-space-2);
}
.mjl-sidebar-child-link {
	border-radius: var(--mjl-radius-control);
	color: var(--mjl-color-text-secondary);
	display: block;
	font-size: 12px;
	line-height: 1.3;
	padding: var(--mjl-space-2);
	text-decoration: none;
}
.mjl-sidebar-child-link-active { background: var(--mjl-color-surface-selected); color: var(--mjl-color-action); font-weight: 700; }
.mjl-sidebar-profile {
	align-items: center;
	border-top: 1px solid var(--mjl-color-border-subtle);
	display: flex;
	gap: var(--mjl-space-2);
	margin-top: auto;
	min-width: 0;
	padding: var(--mjl-space-4) var(--mjl-space-1) 0;
}
.mjl-profile-mark {
	align-items: center;
	background: var(--mjl-color-surface-selected);
	border-radius: 50%;
	color: var(--mjl-color-primary);
	display: inline-flex;
	flex: 0 0 34px;
	font-size: 12px;
	font-weight: 700;
	height: 34px;
	justify-content: center;
}
.mjl-sidebar-profile div { min-width: 0; }
.mjl-sidebar-profile strong, .mjl-sidebar-profile small { display: block; overflow-wrap: anywhere; }
.mjl-sidebar-profile strong { color: var(--mjl-color-text); font-size: 12px; line-height: 1.3; }
.mjl-sidebar-profile small { color: var(--mjl-color-text-muted); font-size: 11px; line-height: 1.3; }
.mjl-module-topbar {
	align-items: center;
	background: var(--mjl-color-surface);
	border-bottom: 1px solid var(--mjl-color-border-subtle);
	box-sizing: border-box;
	display: flex;
	gap: var(--mjl-space-4);
	min-height: 64px;
	padding: var(--mjl-space-3) 36px;
}
.mjl-shell-breadcrumb { align-items: center; color: var(--mjl-color-text-muted); display: flex; flex-wrap: wrap; font-size: 12px; gap: var(--mjl-space-2); }
.mjl-shell-breadcrumb a { color: var(--mjl-color-action); }
.mjl-shell-breadcrumb strong { color: var(--mjl-color-text); font-weight: 600; }

.mjl-action {
	align-items: center;
	border: 1px solid transparent;
	border-radius: var(--mjl-radius-control);
	box-sizing: border-box;
	cursor: pointer;
	display: inline-flex;
	font-size: 14px;
	font-weight: 600;
	justify-content: center;
	line-height: 1.25;
	min-height: 40px;
	padding: var(--mjl-space-2) var(--mjl-space-4);
	text-decoration: none;
}

.mjl-module-shell .mjl-action-primary {
	background: var(--mjl-color-action);
	border-color: var(--mjl-color-action);
	color: var(--mjl-color-text-inverse);
	min-height: var(--mjl-touch-target);
}

.mjl-module-shell .mjl-action-secondary {
	background: var(--mjl-color-surface);
	border-color: var(--mjl-color-action);
	color: var(--mjl-color-action);
}

.mjl-module-shell .mjl-action-quiet {
	background: transparent;
	border-color: transparent;
	color: var(--mjl-color-action);
}

.mjl-module-shell .mjl-action-danger {
	background: var(--mjl-color-danger-surface);
	border-color: var(--mjl-color-danger);
	color: var(--mjl-color-danger);
	min-height: var(--mjl-touch-target);
}

.mjl-action:disabled {
	background: var(--mjl-color-surface-disabled);
	border-color: var(--mjl-color-border-subtle);
	color: var(--mjl-color-text-muted);
	cursor: not-allowed;
}

.mjl-page-header {
	margin-bottom: var(--mjl-space-6);
	padding: var(--mjl-space-2) 0 var(--mjl-space-5);
}

.mjl-page-header-layout {
	align-items: flex-start;
	display: flex;
	gap: var(--mjl-space-6);
	justify-content: space-between;
}

.mjl-page-header-content {
	min-width: 0;
}

.mjl-page-header-breadcrumb {
	margin-bottom: var(--mjl-space-3);
}

.mjl-page-header-breadcrumb ol {
	display: flex;
	flex-wrap: wrap;
	gap: var(--mjl-space-2);
	list-style: none;
	margin: 0;
	padding: 0;
}

.mjl-page-header-breadcrumb li {
	color: var(--mjl-color-text-muted);
	font-size: 12px;
	line-height: 1.4;
}

.mjl-page-header-breadcrumb li:not(:last-child)::after {
	content: "/";
	margin-left: var(--mjl-space-2);
}

.mjl-page-header-breadcrumb a {
	color: var(--mjl-color-action);
}

.mjl-workspace h1,
.mjl-workspace h2 {
	color: #16324f;
	letter-spacing: 0;
	margin: 0;
}

.mjl-workspace h1 {
	font-size: 1.5rem;
	font-weight: 700;
	line-height: 2rem;
}

.mjl-workspace h2 {
	font-size: 1.25rem;
	font-weight: 600;
	line-height: 1.5rem;
}

.mjl-page-header-description,
.mjl-section-heading p,
.mjl-dashboard-card p,
.mjl-nav-card span {
	color: #5c6870;
	font-size: 14px;
	line-height: 1.45;
}

.mjl-page-header-description {
	margin: var(--mjl-space-2) 0 0;
	max-width: 720px;
}

.mjl-page-header-context {
	display: flex;
	margin: var(--mjl-space-3) 0 0;
}

.mjl-page-header-context div {
	align-items: baseline;
	display: flex;
	flex-wrap: wrap;
	gap: var(--mjl-space-2);
}

.mjl-page-header-context dt,
.mjl-card-label {
	color: var(--mjl-color-text-muted);
	font-size: 12px;
	font-weight: 600;
	margin: 0;
	text-transform: uppercase;
}

.mjl-page-header-context dd {
	color: var(--mjl-color-text);
	font-size: 14px;
	font-weight: 700;
	margin: 0;
}

.mjl-page-header-actions {
	align-items: center;
	display: flex;
	flex: 0 0 auto;
	flex-wrap: wrap;
	gap: var(--mjl-space-2);
	justify-content: flex-end;
}

.mjl-workspace-section {
	margin: 0 0 22px;
}

.mjl-section-heading {
	margin: 0 0 10px;
}

.mjl-section-heading p,
.mjl-dashboard-card p {
	margin: 5px 0 0;
}

.mjl-card-grid,
.mjl-link-grid {
	display: grid;
	gap: 12px;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.mjl-dashboard-card,
.mjl-nav-card {
	background: #ffffff;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	box-shadow: 0 6px 16px rgba(32, 37, 41, 0.05);
	box-sizing: border-box;
	min-height: 148px;
	padding: 18px;
}

.mjl-dashboard-card {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
}

.mjl-card-metadata {
	border-top: 1px solid #e5eaed;
	display: grid;
	gap: 5px;
	margin: 12px 0 0;
	padding-top: 10px;
}

.mjl-card-metadata div {
	display: grid;
	gap: 3px;
	grid-template-columns: minmax(82px, 0.7fr) minmax(0, 1.3fr);
}

.mjl-card-metadata dt {
	color: #52616b;
	font-size: 12px;
	font-weight: 700;
}

.mjl-card-metadata dd {
	margin: 0;
	overflow-wrap: anywhere;
}

.mjl-dashboard-card-warning {
	border-left: 4px solid #b56b00;
}

.mjl-dashboard-card-danger {
	border-left: 4px solid #b42318;
}

.mjl-card-value {
	color: #16324f;
	display: block;
	font-size: 2rem;
	line-height: 2.5rem;
}

.mjl-card-link,
.mjl-nav-card {
	color: #164f7a;
	font-weight: 700;
	text-decoration: none;
}

.mjl-card-link {
	margin-top: 14px;
}

.mjl-nav-card {
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-height: 104px;
}

.mjl-status-pill,
.mjl-status-badge {
	border: 1px solid #c5ced4;
	border-radius: var(--mjl-radius-status-badge);
	box-sizing: border-box;
	color: #34414a;
	display: inline-flex;
	align-items: center;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.2;
	margin-top: 10px;
	min-height: 20px;
	padding: 2px 8px;
}

.mjl-status-info {
	background: var(--mjl-color-status-info-surface);
	border-color: var(--mjl-color-status-info);
	color: var(--mjl-color-status-info);
}

.mjl-status-success {
	background: var(--mjl-color-status-success-badge-surface);
	border-color: var(--mjl-color-status-success);
	color: var(--mjl-color-status-success);
}

.mjl-status-warning {
	background: var(--mjl-color-status-warning-surface);
	border-color: var(--mjl-color-status-warning);
	color: var(--mjl-color-status-warning);
}

.mjl-status-danger {
	background: var(--mjl-color-status-danger-surface);
	border-color: var(--mjl-color-status-danger);
	color: var(--mjl-color-status-danger);
}

.mjl-tabs {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 0 0 16px;
}

.mjl-tabs a {
	background: #ffffff;
	border: 1px solid #c5ced4;
	border-radius: 6px;
	color: #34414a;
	font-size: 13px;
	font-weight: 700;
	line-height: 1.2;
	padding: 8px 11px;
	text-decoration: none;
}

.mjl-tabs a:focus,
.mjl-tabs .mjl-tab-active {
	background: #16324f;
	border-color: #16324f;
	color: #ffffff;
}

.mjl-alert-grid {
	display: grid;
	gap: 12px;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.mjl-alert-card {
	background: #ffffff;
	border: 1px solid #d7dee2;
	border-left-width: 4px;
	border-radius: 6px;
	box-shadow: 0 6px 16px rgba(32, 37, 41, 0.05);
	box-sizing: border-box;
	padding: 18px;
}

.mjl-alert-warning {
	border-left-color: #b56b00;
}

.mjl-alert-danger {
	border-left-color: #b42318;
}

.mjl-alert-card h3 {
	color: #16324f;
	font-size: 16px;
	line-height: 1.35;
	margin: 10px 0 0;
}

.mjl-alert-card p,
.mjl-alert-meta {
	color: #5c6870;
	font-size: 14px;
	line-height: 1.45;
}

.mjl-alert-meta {
	display: grid;
	gap: 8px;
	grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
	margin: 14px 0 0;
}

.mjl-alert-meta div {
	min-width: 0;
}

.mjl-alert-meta dt {
	color: #5c6870;
	font-size: 12px;
	font-weight: 700;
	margin: 0 0 3px;
	text-transform: uppercase;
}

.mjl-alert-meta dd {
	color: #202529;
	margin: 0;
	overflow-wrap: anywhere;
}

.mjl-empty-state {
	background: #ffffff;
	border: 1px dashed #b9c4ca;
	border-radius: 6px;
	color: #5c6870;
	font-size: 14px;
	padding: 16px;
}

.mjl-empty-state-warning {
	background: #fff9ec;
	border-color: #d99a2b;
	color: #6f4200;
}

.mjl-dashboard-table table {
	background: #ffffff;
	border: 1px solid #d7dee2;
}

.mjl-table-link {
	color: #164f7a;
	font-weight: 700;
	text-decoration: none;
}

.mjl-report-selector,
.mjl-report-context {
	background: #ffffff;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	box-shadow: 0 6px 16px rgba(32, 37, 41, 0.05);
	box-sizing: border-box;
	padding: 18px;
}

.mjl-report-selector form,
.mjl-report-filter-bar {
	display: grid;
	gap: 12px;
}

.mjl-report-selector label,
.mjl-report-filter-bar label {
	color: #34414a;
	display: grid;
	font-size: 13px;
	font-weight: 700;
	gap: 5px;
}

.mjl-report-selector select,
.mjl-report-filter-bar select,
.mjl-report-filter-bar input {
	box-sizing: border-box;
	width: 100%;
}

.mjl-report-filter-bar {
	background: #ffffff;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	box-shadow: 0 6px 16px rgba(32, 37, 41, 0.05);
	grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
	padding: 18px;
}

.mjl-report-filter-actions {
	align-self: end;
}

.mjl-report-description {
	color: #5c6870;
	font-size: 14px;
	line-height: 1.45;
	margin: 0;
}

.mjl-report-active-filters {
	background: #f5f7f8;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	color: #5c6870;
	display: grid;
	font-size: 14px;
	gap: 4px;
	margin: 14px 0;
	padding: 12px;
}

.mjl-report-active-filters strong {
	color: #202529;
	font-size: 13px;
}

.mjl-report-export-toolbar {
	border-top: 1px solid #d7dee2;
	margin-top: 14px;
	padding-top: 14px;
}

.mjl-report-table table {
	background: #ffffff;
	border: 1px solid #d7dee2;
}

.mjl-report-table th,
.mjl-report-table td {
	vertical-align: top;
}

.mjl-activity-panel,
.mjl-activity-card {
	background: #ffffff;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	box-shadow: 0 6px 16px rgba(32, 37, 41, 0.05);
	box-sizing: border-box;
	margin-bottom: 18px;
	padding: 18px;
}

.mjl-activity-detail-grid {
	display: grid;
	gap: 16px;
	grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
}

.mjl-activity-form,
.mjl-activity-action-form {
	display: grid;
	gap: 12px;
}

.mjl-activity-form {
	grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
}

.mjl-activity-form label,
.mjl-activity-action-form label {
	color: #34414a;
	display: grid;
	font-size: 13px;
	font-weight: 700;
	gap: 5px;
}

.mjl-activity-form input,
.mjl-activity-form select,
.mjl-activity-action-form input {
	box-sizing: border-box;
	max-width: 100%;
	width: 100%;
}

.mjl-planning-form {
	align-items: start;
	grid-template-columns: minmax(0, 1fr) minmax(15rem, 18rem);
	gap: var(--mjl-space-5);
}

.mjl-planning-form textarea { box-sizing: border-box; max-width: 100%; width: 100%; }
.mjl-activity-form-actions {
	align-items: center;
	display: flex;
	flex-wrap: wrap;
	gap: var(--mjl-space-3);
	grid-column: 1 / -1;
	justify-content: flex-end;
}

.mjl-form-field {
	display: grid;
	gap: 5px;
}

.mjl-field-requirement,
.mjl-field-description {
	color: var(--mjl-color-text-muted);
	font-size: 12px;
	font-weight: 400;
	margin: 0;
}

.mjl-form-field-error :where(input, select, textarea),
.mjl-module-shell [aria-invalid="true"] {
	border-color: var(--mjl-color-danger);
}

.mjl-field-error-message {
	color: var(--mjl-color-danger);
	font-size: 13px;
	font-weight: 700;
	margin: 0;
}

.mjl-form-error-summary {
	background: var(--mjl-color-danger-surface);
	border: 2px solid var(--mjl-color-danger);
	border-radius: var(--mjl-radius-card);
	color: var(--mjl-color-danger);
	grid-column: 1 / -1;
	padding: var(--mjl-space-4);
}

.mjl-form-error-summary ul {
	margin: var(--mjl-space-2) 0 0;
	padding-left: var(--mjl-space-5);
}

.mjl-form-error-summary a {
	color: var(--mjl-color-danger);
}

.mjl-system-state {
	border: 1px solid var(--mjl-color-border-subtle);
	border-left-width: 4px;
	border-radius: var(--mjl-radius-card);
	margin: var(--mjl-space-3) 0;
	padding: var(--mjl-space-3) var(--mjl-space-4);
}

.mjl-system-state strong,
.mjl-system-state p {
	display: block;
	margin: 0 0 var(--mjl-space-2);
}

.mjl-system-state-info,
.mjl-system-state-loading {
	background: var(--mjl-color-surface-selected);
	border-left-color: var(--mjl-color-action);
}

.mjl-system-state-success {
	background: #edf7f1;
	border-left-color: #1f6b3a;
}

.mjl-system-state-warning,
.mjl-system-state-partial-error,
.mjl-system-state-unavailable {
	background: #fff4df;
	border-left-color: #d99a2b;
}

.mjl-system-state-danger,
.mjl-system-state-permission {
	background: var(--mjl-color-danger-surface);
	border-left-color: var(--mjl-color-danger);
}

.mjl-table-filters {
	align-items: end;
	display: grid;
	gap: var(--mjl-space-3);
	grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	margin-bottom: var(--mjl-space-4);
}

.mjl-table-filters label {
	display: grid;
	font-size: 13px;
	font-weight: 700;
	gap: var(--mjl-space-1);
}

.mjl-table-filters select,
.mjl-table-filters input {
	box-sizing: border-box;
	min-height: 40px;
	width: 100%;
}

.mjl-filter-summary {
	color: var(--mjl-color-text-secondary);
	font-size: 13px;
	grid-column: 1 / -1;
	margin: 0;
}

.mjl-scoped-count {
	color: var(--mjl-color-text-secondary);
	font-size: 13px;
}

.mjl-pagination {
	align-items: center;
	display: flex;
	flex-wrap: wrap;
	gap: var(--mjl-space-3);
	justify-content: space-between;
	margin-top: var(--mjl-space-4);
}

.mjl-decision-consequence {
	background: #fff4df;
	border: 1px solid #d99a2b;
	border-radius: var(--mjl-radius-card);
	color: #6f4200;
	padding: var(--mjl-space-3);
}

.mjl-decision-consequence strong,
.mjl-decision-consequence p {
	display: block;
	margin: 0 0 var(--mjl-space-1);
}

.mjl-confirmation-dialog {
	background: transparent;
	border: 0;
	max-width: min(560px, calc(100vw - 32px));
	padding: 0;
}

.mjl-confirmation-dialog::backdrop {
	background: rgba(22, 50, 79, 0.55);
}

.mjl-confirmation-panel {
	background: var(--mjl-color-surface);
	border-radius: var(--mjl-radius-panel);
	box-shadow: var(--mjl-shadow-panel);
	color: var(--mjl-color-text);
	padding: var(--mjl-space-6);
}

.mjl-confirmation-panel h2 {
	color: var(--mjl-color-primary);
	margin-top: 0;
}

.mjl-confirmation-actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--mjl-space-3);
	justify-content: flex-end;
	margin-top: var(--mjl-space-5);
}

.mjl-confirmation-actions :where(button, .button, .mjl-action) {
	min-height: var(--mjl-touch-target);
}

.mjl-activity-meta {
	display: grid;
	gap: 12px;
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	margin: 0;
}

.mjl-activity-meta div {
	background: #f5f7f8;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	padding: 12px;
}

.mjl-activity-meta dt {
	color: #5c6870;
	font-size: 12px;
	font-weight: 700;
	margin: 0 0 5px;
	text-transform: uppercase;
}

.mjl-activity-meta dd {
	color: #202529;
	font-size: 14px;
	line-height: 1.35;
	margin: 0;
	overflow-wrap: anywhere;
}

.mjl-activity-decision {
	border-left: 4px solid #164f7a;
}

.mjl-activity-action-form {
	border-top: 1px solid #d7dee2;
	margin-top: 12px;
	padding-top: 12px;
}

.mjl-document-summary {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-bottom: 12px;
}

.mjl-document-summary span {
	background: #f5f7f8;
	border: 1px solid #d7dee2;
	border-radius: 999px;
	color: #34414a;
	font-size: 13px;
	font-weight: 700;
	padding: 6px 10px;
}

.mjl-document-summary-downloadable span:first-child {
	background: #edf7f1;
	border-color: #8ac09c;
	color: #1f6b3a;
}

.mjl-document-summary-unavailable span:first-child {
	background: #fff4df;
	border-color: #d99a2b;
	color: #6f4200;
}

.mjl-document-summary-missing span:first-child {
	background: #fff0ed;
	border-color: #e08a80;
	color: #8a1f15;
}

.mjl-document-list {
	border: 1px solid #d7dee2;
	border-radius: 6px;
	display: grid;
	gap: 0;
	margin-top: 12px;
	overflow: hidden;
}

.mjl-document-row {
	align-items: center;
	background: #ffffff;
	border-top: 1px solid #d7dee2;
	display: flex;
	gap: 12px;
	justify-content: space-between;
	padding: 10px 12px;
}

.mjl-document-row:first-child {
	border-top: 0;
}

.mjl-document-row span {
	color: #202529;
	font-size: 14px;
	font-weight: 700;
	min-width: 0;
	overflow-wrap: anywhere;
}

.mjl-roadmap-list {
	color: #202529;
	font-size: 14px;
	line-height: 1.5;
	margin: 10px 0 0;
	padding-left: 20px;
}

.mjl-roadmap-list li {
	margin: 0 0 6px;
}

.mjl-activity-timeline {
	border-left: 2px solid #c5ced4;
	list-style: none;
	margin: 0 0 0 8px;
	padding: 0 0 0 18px;
}

.mjl-activity-timeline li {
	margin: 0 0 16px;
	position: relative;
}

.mjl-activity-timeline li::before {
	background: #164f7a;
	border: 2px solid #ffffff;
	border-radius: 50%;
	box-shadow: 0 0 0 2px #c5ced4;
	content: "";
	height: 10px;
	left: -24px;
	position: absolute;
	top: 7px;
	width: 10px;
}

.mjl-activity-timeline strong {
	color: #16324f;
	display: block;
	font-size: 15px;
	margin-top: 8px;
}

.mjl-activity-timeline p {
	color: #5c6870;
	font-size: 14px;
	line-height: 1.45;
	margin: 4px 0 0;
}

.mjl-timeline-comment {
	background: #f5f7f8;
	border-left: 3px solid #7fb3d5;
	color: #202529 !important;
	padding: 8px 10px;
}

.mjl-card-link:focus,
.mjl-nav-card:focus,
.mjl-table-link:focus,
.mjl-sidebar-link:focus,
.mjl-sidebar-child-link:focus,
.mjl-skip-link:focus {
	outline: 2px solid var(--mjl-focus-ring);
	outline-offset: var(--mjl-space-1);
}

.mjl-module-shell :where(a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])):focus-visible {
	outline: 2px solid var(--mjl-focus-ring);
	outline-offset: var(--mjl-space-1);
}

.mjl-module-shell :where(input, select, textarea) {
	border-color: var(--mjl-color-border-strong) !important;
	border-radius: var(--mjl-radius-control) !important;
	box-sizing: border-box;
	min-height: var(--mjl-control-standard) !important;
}

.mjl-module-shell :where(button:not(.mjl-action), .button:not(.mjl-action), .butAction:not(.mjl-action), .butActionDelete:not(.mjl-action)) {
	border-radius: var(--mjl-radius-control) !important;
	box-sizing: border-box;
	min-height: var(--mjl-control-standard) !important;
}

.mjl-module-shell :where(button, input, select, textarea):disabled,
.mjl-module-shell [aria-disabled="true"] {
	background: var(--mjl-color-surface-disabled);
	border-color: var(--mjl-color-border-subtle);
	color: var(--mjl-color-text-muted);
	cursor: not-allowed;
}

.mjl-module-shell .mjl-action-primary:focus-visible,
.mjl-module-shell .mjl-action-danger:focus-visible {
	box-shadow: 0 0 0 4px var(--mjl-focus-ring);
	outline-color: var(--mjl-color-text-inverse);
	outline-offset: 2px;
}

.mjl-dashboard-table tbody td,
.mjl-report-table tbody td,
.mjl-operational-table tbody td {
	line-height: 24px;
	padding-bottom: 8px;
	padding-top: 8px;
}

.mjl-module-shell tr.mjl-row-interactive > td {
	padding-bottom: 10px;
	padding-top: 10px;
}

@media (hover: hover) {
	.mjl-sidebar-link:hover,
	.mjl-sidebar-child-link:hover {
		background: var(--mjl-color-surface-selected);
		border-color: var(--mjl-color-border);
	}

	.mjl-tabs a:hover {
		background: #16324f;
		border-color: #16324f;
		color: #ffffff;
	}

	.mjl-card-link:hover,
	.mjl-table-link:hover {
		color: var(--mjl-color-primary);
		text-decoration: underline;
	}

	.mjl-nav-card:hover {
		background: var(--mjl-color-surface-selected);
		border-color: var(--mjl-color-border);
		box-shadow: var(--mjl-shadow-card);
	}

	.mjl-module-shell .mjl-action-primary:hover {
		background: #123f62;
		border-color: #123f62;
	}

	.mjl-module-shell .mjl-action-secondary:hover,
	.mjl-module-shell .mjl-action-quiet:hover {
		background: var(--mjl-color-surface-selected);
	}

	.mjl-module-shell .mjl-action-danger:hover {
		background: #f7d9d9;
		border-color: #6f1717;
		color: #6f1717;
	}

	.mjl-table-action-menu-item:hover {
		background: var(--mjl-color-surface-subtle);
	}
}

.mjl-sidebar-link:active,
.mjl-sidebar-child-link:active,
.mjl-tabs a:active,
.mjl-navigation-trigger:active,
.mjl-navigation-close:active,
.mjl-navigation-backdrop:active,
.mjl-table-action-menu > summary:active,
.mjl-table-action-menu-item:active {
	background: var(--mjl-color-surface-selected);
	box-shadow: inset 0 1px 2px rgba(22, 50, 79, 0.24);
}

.mjl-card-link:active,
.mjl-table-link:active {
	color: var(--mjl-color-primary);
	text-decoration: underline;
}

.mjl-nav-card:active {
	background: var(--mjl-color-surface-selected);
	box-shadow: inset 0 1px 2px rgba(22, 50, 79, 0.24);
}

.mjl-module-shell .mjl-action:active {
	box-shadow: inset 0 1px 2px rgba(22, 50, 79, 0.24);
}

@media (min-width: 1280px) {
	.mjl-module-shell {
		--mjl-dolibarr-edge-correction: 3px;
	}
}

@media (max-width: 980px) {
	.mjl-module-shell {
		display: block;
		margin-left: 0;
		width: auto;
	}

	.mjl-module-sidebar {
		margin-bottom: 16px;
		min-height: 0;
		position: static;
	}

	.mjl-sidebar-nav { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
	.mjl-module-topbar { padding: var(--mjl-space-3) var(--mjl-space-4); }
	.mjl-module-main { padding: var(--mjl-space-5) var(--mjl-space-4) 40px; }

	.mjl-module-shell.mjl-navigation-enhanced .mjl-navigation-trigger {
		align-items: center;
		background: var(--mjl-color-action);
		border: 1px solid var(--mjl-color-action);
		border-radius: var(--mjl-radius-control);
		box-sizing: border-box;
		color: var(--mjl-color-text-inverse);
		cursor: pointer;
		display: inline-flex;
		font-size: 14px;
		font-weight: 700;
		height: var(--mjl-control-compact) !important;
		justify-content: center;
		margin-bottom: var(--mjl-space-3);
		min-height: var(--mjl-control-compact) !important;
		padding: 0 var(--mjl-space-3);
	}

	.mjl-module-shell.mjl-navigation-enhanced .mjl-module-sidebar {
		border-radius: 0;
		bottom: 0;
		box-shadow: var(--mjl-shadow-panel);
		left: 0;
		margin: 0;
		height: 100vh;
		height: 100dvh;
		max-width: 320px;
		overflow-y: auto;
		position: fixed;
		top: 0;
		transform: translateX(-105%);
		transition: transform 180ms cubic-bezier(0.2, 0, 0, 1);
		visibility: hidden;
		width: min(85vw, 320px);
		z-index: 300;
	}

	.mjl-module-shell.mjl-navigation-enhanced .mjl-navigation-close {
		align-items: center;
		background: var(--mjl-color-surface);
		border: 1px solid var(--mjl-color-action);
		border-radius: var(--mjl-radius-control);
		color: var(--mjl-color-action);
		cursor: pointer;
		display: inline-flex;
		font-size: 14px;
		font-weight: 700;
		justify-content: center;
		margin: 0 0 var(--mjl-space-3);
		min-height: var(--mjl-touch-target);
		padding: var(--mjl-space-2) var(--mjl-space-3);
	}

	.mjl-module-shell.mjl-navigation-enhanced.mjl-navigation-is-open .mjl-module-sidebar {
		transform: translateX(0);
		visibility: visible;
	}

	.mjl-module-shell.mjl-navigation-enhanced.mjl-navigation-is-open .mjl-navigation-backdrop {
		background: rgba(32, 37, 41, 0.72);
		border: 0;
		bottom: 0;
		cursor: pointer;
		display: block;
		left: 0;
		padding: 0;
		position: fixed;
		right: 0;
		top: 0;
		z-index: 299;
	}

	body.mjl-navigation-open {
		overflow: hidden;
	}
}

@media (any-pointer: coarse) {
	.mjl-module-shell.mjl-navigation-enhanced .mjl-navigation-trigger {
		height: auto !important;
		min-height: var(--mjl-touch-target) !important;
		padding: var(--mjl-space-2) var(--mjl-space-3);
	}
}

@media (max-width: 768px), (any-pointer: coarse) {
	.mjl-sidebar-link,
	.mjl-sidebar-child-link,
	.mjl-action,
	.mjl-module-shell .mjl-table-action-menu > summary,
	.mjl-module-shell :where(button, .button, .butAction, .butActionDelete, input, select, textarea) {
		align-items: center;
		box-sizing: border-box;
		min-height: var(--mjl-touch-target) !important;
	}

	.mjl-sidebar-link { display: flex; }
	.mjl-sidebar-child-link,
	.mjl-action { display: grid; }
}

.mjl-table-action-menu {
	display: inline-block;
	position: relative;
}

.mjl-table-action-menu > summary {
	color: var(--mjl-color-action);
	cursor: pointer;
	font-weight: 700;
	list-style: none;
	min-height: 32px;
	padding: var(--mjl-space-2);
}

.mjl-table-action-menu > summary::-webkit-details-marker {
	display: none;
}

.mjl-table-action-menu > summary::after {
	content: " ▾";
}

.mjl-table-action-menu > summary:focus-visible,
.mjl-table-action-menu-item:focus-visible {
	outline: 3px solid var(--mjl-focus-ring);
	outline-offset: 2px;
}

.mjl-table-action-menu-panel {
	background: var(--mjl-color-surface);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-control);
	box-shadow: var(--mjl-shadow-panel);
	display: grid;
	left: 0;
	max-height: min(320px, calc(100vh - 16px));
	min-width: 190px;
	overflow: auto;
	position: absolute;
	top: calc(100% + 4px);
	z-index: 40;
}

.mjl-table-action-menu-align-end .mjl-table-action-menu-panel {
	left: auto;
	right: 0;
}

.mjl-table-action-menu-open-up .mjl-table-action-menu-panel {
	bottom: calc(100% + 4px);
	top: auto;
}

.mjl-table-action-menu-item {
	color: var(--mjl-color-text);
	display: block;
	padding: var(--mjl-space-2) var(--mjl-space-3);
	text-decoration: none;
	white-space: nowrap;
}

.mjl-table-action-menu-item:focus {
	background: var(--mjl-color-surface-subtle);
}

.mjl-table-action-menu-item-danger {
	color: var(--mjl-color-danger);
}

@media (max-width: 768px) {
	.mjl-operational-table table,
	.mjl-operational-table tbody,
	.mjl-operational-table tr,
	.mjl-operational-table td {
		display: block;
		width: 100%;
	}

	.mjl-operational-table thead {
		border: 0;
		clip: rect(0 0 0 0);
		height: 1px;
		margin: -1px;
		overflow: hidden;
		padding: 0;
		position: absolute;
		white-space: nowrap;
		width: 1px;
	}

	.mjl-operational-table tr {
		border: 1px solid var(--mjl-color-border-subtle);
		border-radius: var(--mjl-radius-card);
		box-sizing: border-box;
		margin-bottom: var(--mjl-space-3);
		padding: var(--mjl-space-3);
	}

	.mjl-operational-table td {
		border: 0;
		box-sizing: border-box;
		display: grid;
		gap: var(--mjl-space-2);
		grid-template-columns: minmax(110px, 35%) 1fr;
		padding: var(--mjl-space-2) 0;
		text-align: left !important;
	}

	.mjl-operational-table tr.mjl-row-interactive > td {
		min-height: var(--mjl-row-interactive);
		padding-bottom: 10px;
		padding-top: 10px;
	}

	.mjl-operational-table td::before {
		color: var(--mjl-color-text-muted);
		content: attr(data-label);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.mjl-operational-table .mjl-table-empty-row {
		display: table-row;
	}

	.mjl-operational-table .mjl-table-empty-row td {
		display: block;
	}

	.mjl-operational-table .mjl-table-empty-row td::before {
		content: none;
	}
}

@media (max-width: 720px) {
	.mjl-page-header-layout {
		display: grid;
		gap: var(--mjl-space-4);
	}

	.mjl-page-header-actions {
		justify-content: flex-start;
	}

	.mjl-activity-detail-grid {
		grid-template-columns: 1fr;
	}
}

@media (prefers-reduced-motion: reduce) {
	.mjl-module-shell *,
	.mjl-module-shell *::before,
	.mjl-module-shell *::after {
		scroll-behavior: auto !important;
		transition-duration: 0ms !important;
	}
}

.mjl-form-grid { display: grid; gap: var(--mjl-space-3); grid-template-columns: minmax(10rem, 1fr) minmax(16rem, 2fr); }
.mjl-activity-form-main { display: grid; gap: var(--mjl-space-4); min-width: 0; }
.mjl-planning-form .mjl-activity-form-section,
.mjl-activity-budget {
	background: var(--mjl-color-surface);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-card);
	margin: 0;
	min-width: 0;
	padding: var(--mjl-space-4);
}
.mjl-activity-form-section legend { font-weight: 700; padding: 0 var(--mjl-space-2); }
.mjl-activity-form-section > .mjl-field-description { margin: 0 0 var(--mjl-space-3); }
.mjl-activity-fields { display: grid; gap: var(--mjl-space-4); grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mjl-activity-field-wide { grid-column: 1 / -1; }
.mjl-planning-form .mjl-form-field label,
.mjl-operation-row label { color: var(--mjl-color-text); font-size: 13px; font-weight: 700; }
.mjl-planning-form .mjl-form-field label { display: block; }
.mjl-planning-form textarea { min-height: 6rem; resize: vertical; }
.mjl-operation-row { align-items: end; border-top: 1px solid var(--mjl-color-border-subtle); display: grid; gap: var(--mjl-space-3); grid-template-columns: repeat(2, minmax(0, 1fr)) auto; padding: var(--mjl-space-3) 0; }
.mjl-operation-row h3 { color: var(--mjl-color-text-muted); font-size: 12px; grid-column: 1 / -1; margin: 0; }
.mjl-operation-row label:first-of-type { grid-column: 1 / -1; }
.mjl-operation-row label { display: grid; gap: var(--mjl-space-1); min-width: 0; }
.mjl-activity-budget { position: sticky; top: var(--mjl-space-4); }
.mjl-activity-budget h2 { font-size: 1rem; margin: 0 0 var(--mjl-space-3); }
.mjl-activity-budget > p { color: var(--mjl-color-text-muted); font-size: 12px; margin: var(--mjl-space-3) 0 0; }
.mjl-activity-totals { margin: 0; }
.mjl-activity-totals div { border-bottom: 1px solid var(--mjl-color-border-subtle); display: flex; gap: var(--mjl-space-2); justify-content: space-between; padding: var(--mjl-space-3) 0; }
.mjl-activity-totals dt { color: var(--mjl-color-text-muted); }
.mjl-activity-totals dd { font-weight: 700; margin: 0; text-align: right; }
.mjl-form-recovery-note { background: var(--mjl-color-status-warning-surface); border-radius: var(--mjl-radius-card); grid-column: 1 / -1; margin: 0; padding: var(--mjl-space-3); }
.mjl-revision-summary { max-height: 32rem; overflow: auto; white-space: pre-wrap; }
.mjl-operation-card {
	background: var(--mjl-color-surface);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-card);
	display: grid;
	gap: var(--mjl-space-3);
	margin-bottom: var(--mjl-space-4);
	padding: var(--mjl-space-4);
}
.mjl-operation-card > :where(h2, p, dl, form) { margin-block: 0; min-width: 0; }
.mjl-operation-card > :where(h2, p) { overflow-wrap: anywhere; }
.mjl-operation-card form {
	align-items: end;
	display: grid;
	gap: var(--mjl-space-3);
	grid-template-columns: repeat(2, minmax(10rem, 1fr)) minmax(14rem, 2fr) auto;
}
.mjl-operation-card form label { display: grid; gap: var(--mjl-space-1); }
.mjl-operation-card form textarea { min-height: 4.5rem; resize: vertical; }

@media (max-width: 768px) {
	.mjl-form-grid, .mjl-operation-row, .mjl-operation-card form { grid-template-columns: 1fr; }
	.mjl-operation-row label:first-of-type { grid-column: auto; }
	.mjl-planning-form { grid-template-columns: 1fr; }
	.mjl-activity-budget { position: static; }
}

@media (max-width: 540px) {
	.mjl-activity-fields { grid-template-columns: 1fr; }
}

@media (forced-colors: active) {
	.mjl-module-shell :where(a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])):focus-visible {
		outline-color: Highlight;
	}

	.mjl-status-pill,
	.mjl-status-badge {
		border-color: CanvasText;
	}
}

@media print {
	.mjl-module-sidebar,
	.mjl-navigation-trigger,
	.mjl-navigation-backdrop,
	.mjl-navigation-close,
	.mjl-module-topbar,
	.mjl-page-header-actions,
	.mjl-report-export-toolbar,
	.mjl-table-action-menu {
		display: none !important;
	}

	.mjl-module-shell {
		display: block;
		margin: 0;
		width: auto;
	}

	.mjl-workspace,
	.mjl-module-shell,
	.mjl-dashboard-card,
	.mjl-report-context,
	.mjl-report-table table {
		background: #ffffff;
		box-shadow: none;
		color: #000000;
	}

	.mjl-status-pill,
	.mjl-status-badge,
	.mjl-activity-timeline,
	.mjl-report-table table {
		break-inside: avoid;
	}
}

/* Reusable form controls used by the Activity planning form. */
.mjl-date-control { display: flex; flex-wrap: wrap; gap: var(--mjl-space-2); position: relative; }
.mjl-date-control > input { flex: 1 1 12rem; }
.mjl-date-calendar { background: var(--mjl-color-surface); border: 1px solid var(--mjl-color-border-subtle); border-radius: var(--mjl-radius-card); box-shadow: 0 8px 24px rgba(0, 0, 0, .16); inset-inline-start: 0; padding: var(--mjl-space-2); position: absolute; top: 100%; z-index: 30; }
.mjl-date-calendar[hidden] { display: none; }
.mjl-date-calendar .ui-datepicker { background: var(--mjl-color-surface); border: 0; color: var(--mjl-color-text); }
.mjl-date-calendar .ui-datepicker a:focus-visible { outline: 2px solid var(--mjl-focus-ring); outline-offset: 2px; }
.mjl-module-shell .select2-container { max-width: 100%; }
.mjl-module-shell .select2-container .select2-selection--single { min-height: 2.5rem; }
.mjl-module-shell .select2-container--focus .select2-selection { outline: 2px solid var(--mjl-focus-ring); outline-offset: 2px; }

/* Activities list: the scoped monitoring projection is rendered as a compact table. */
.mjl-activity-filter-panel,
.mjl-activity-list {
	background: var(--mjl-color-surface);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-panel);
	margin-bottom: var(--mjl-space-5);
}
.mjl-activity-filter-toolbar {
	align-items: center;
	display: flex;
	flex-wrap: wrap;
	gap: var(--mjl-space-3);
	padding: var(--mjl-space-4);
}
.mjl-activity-filter-toolbar label { font-size: 13px; font-weight: 600; }
.mjl-activity-filter-toolbar input { flex: 1 1 16rem; min-width: 0; }
.mjl-activity-filter-details { border-top: 1px solid var(--mjl-color-border-subtle); padding: var(--mjl-space-3) var(--mjl-space-4); }
.mjl-activity-filter-details > summary { color: var(--mjl-color-action); cursor: pointer; font-size: 13px; font-weight: 700; min-height: var(--mjl-control-standard); padding: var(--mjl-space-2) 0; }
.mjl-activity-filter-details > summary:focus-visible,
.mjl-activity-list-expansion summary:focus-visible { outline: 2px solid var(--mjl-focus-ring); outline-offset: 2px; }
.mjl-activity-filter-details .mjl-form-grid { margin: var(--mjl-space-3) 0; }
.mjl-activity-filter-actions { align-items: center; display: flex; flex-wrap: wrap; gap: var(--mjl-space-4); padding-top: var(--mjl-space-2); }
.mjl-activity-filter-actions a { color: var(--mjl-color-action); }
.mjl-activity-list-heading { align-items: center; border-bottom: 1px solid var(--mjl-color-border-subtle); display: flex; flex-wrap: wrap; gap: var(--mjl-space-2); justify-content: space-between; padding: var(--mjl-space-3) var(--mjl-space-4); }
.mjl-activity-list-heading strong { color: var(--mjl-color-primary); font-size: 14px; }
.mjl-activity-list-heading span { color: var(--mjl-color-text-muted); font-size: 12px; }
.mjl-activity-list-scroll,
.mjl-activity-operations-scroll { overflow-x: auto; }
.mjl-data-table { border-collapse: collapse; text-align: left; width: 100%; }
.mjl-activity-list-table { min-width: 980px; }
.mjl-activity-operations-table { min-width: 900px; }
.mjl-data-table th { background: var(--mjl-color-surface-subtle); color: var(--mjl-color-text-muted); font-size: 11px; font-weight: 700; padding: var(--mjl-space-3); }
.mjl-data-table td { border-top: 1px solid var(--mjl-color-border-subtle); font-size: 12px; line-height: 1.4; padding: var(--mjl-space-3); vertical-align: top; }
.mjl-data-table td small { color: var(--mjl-color-text-muted); display: block; font-size: 11px; margin-top: var(--mjl-space-1); }
.mjl-activity-list-name { color: var(--mjl-color-action); font-size: 13px; font-weight: 700; }
.mjl-activity-list-money { font-variant-numeric: tabular-nums; white-space: nowrap; }
.mjl-activity-list-money .mjl-status-pill { margin-top: var(--mjl-space-2); }
.mjl-activity-list-expansion > td { background: var(--mjl-color-surface-subtle); padding: 0 var(--mjl-space-3) var(--mjl-space-3); }
.mjl-activity-list-expansion details { border-bottom: 1px solid var(--mjl-color-border-subtle); }
.mjl-activity-list-expansion summary { color: var(--mjl-color-action); cursor: pointer; font-size: 12px; font-weight: 700; padding: var(--mjl-space-2) 0; }
.mjl-activity-list-expansion details[open] { background: var(--mjl-color-surface); border: 1px solid var(--mjl-color-border-subtle); border-radius: var(--mjl-radius-card); margin: var(--mjl-space-2) 0; padding: 0 var(--mjl-space-3) var(--mjl-space-3); }
.mjl-activity-observation { max-width: 16rem; overflow-wrap: anywhere; white-space: pre-wrap; }
@media (max-width: 768px) {
	.mjl-activity-list-scroll { overflow: visible; }
	.mjl-activity-list-table { display: block; min-width: 0; }
	.mjl-activity-list-table thead { display: none; }
	.mjl-activity-list-table tbody { display: block; }
	.mjl-activity-list-row { border-top: 1px solid var(--mjl-color-border-subtle); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.mjl-activity-list-row td { border: 0; min-width: 0; overflow-wrap: anywhere; }
	.mjl-activity-list-row td:first-child,
	.mjl-activity-list-row td:last-child { grid-column: 1 / -1; }
	.mjl-activity-list-row td::before { color: var(--mjl-color-text-muted); content: attr(data-label); display: block; font-size: 11px; margin-bottom: var(--mjl-space-1); }
	.mjl-activity-list-expansion { display: block; }
	.mjl-activity-list-expansion td { display: block; }
}


/* Activity workspace: central business facts, progressive tabs and assignments. */
.mjl-activity-statusline {
	align-items: center;
	display: flex;
	flex-wrap: wrap;
	gap: var(--mjl-space-2);
	margin: 0 0 var(--mjl-space-4);
}
.mjl-activity-statusline .mjl-status-pill { margin-top: 0; }
.mjl-activity-fact {
	color: var(--mjl-color-text-muted);
	font-size: 13px;
	font-weight: 600;
}
.mjl-activity-financial-strip {
	background: var(--mjl-color-primary);
	border-radius: var(--mjl-radius-panel);
	color: var(--mjl-color-text-inverse);
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	margin: 0 0 var(--mjl-space-5);
	overflow: hidden;
}
.mjl-activity-financial-strip > div {
	border-inline-end: 1px solid rgba(255,255,255,.18);
	min-width: 0;
	padding: var(--mjl-space-4);
}
.mjl-activity-financial-strip > div:last-child { border-inline-end: 0; }
.mjl-activity-financial-strip dt { font-size: 12px; font-weight: 600; margin-bottom: var(--mjl-space-2); opacity: .8; }
.mjl-activity-financial-strip dd { font-size: 18px; font-weight: 700; margin: 0; overflow-wrap: anywhere; }
.mjl-activity-financial-strip small { display: block; margin-top: var(--mjl-space-1); opacity: .72; }
.mjl-activity-tabs { border-bottom: 1px solid var(--mjl-color-border-subtle); gap: 0; margin-bottom: var(--mjl-space-4); }
.mjl-activity-tabs a { border: 0; border-bottom: 3px solid transparent; border-radius: 0; }
.mjl-activity-tabs a[aria-selected="true"] { background: transparent; border-bottom-color: var(--mjl-color-action); color: var(--mjl-color-primary); }
.mjl-activity-tab-panel[hidden] { display: none; }
.mjl-section-heading { align-items: flex-start; display: flex; gap: var(--mjl-space-3); justify-content: space-between; }
.mjl-section-heading :where(h2,p) { margin-top: 0; }
.mjl-activity-description { white-space: normal; }
.mjl-assignment-list { list-style: none; margin: 0; padding: 0; }
.mjl-assignment-list li { align-items: center; border-top: 1px solid var(--mjl-color-border-subtle); display: flex; gap: var(--mjl-space-3); padding: var(--mjl-space-3) 0; }
.mjl-assignment-list li:first-child { border-top: 0; }
.mjl-assignment-list small { color: var(--mjl-color-text-muted); display: block; margin-top: 2px; }
.mjl-assignment-avatar { align-items: center; background: var(--mjl-color-status-info-surface); border-radius: 50%; color: var(--mjl-color-primary); display: inline-flex; flex: 0 0 36px; font-weight: 700; height: 36px; justify-content: center; }
.mjl-activity-operations-table { border-collapse: collapse; width: 100%; }
.mjl-activity-operations-table th, .mjl-activity-operations-table td { border-bottom: 1px solid var(--mjl-color-border-subtle); padding: 10px 12px; text-align: start; vertical-align: middle; }
.mjl-activity-operations-table th { color: var(--mjl-color-text-muted); font-size: 12px; text-transform: uppercase; }
.mjl-dialog-panel { background: var(--mjl-color-surface); border: 1px solid var(--mjl-color-border-subtle); border-radius: var(--mjl-radius-panel); box-shadow: var(--mjl-shadow-panel); padding: var(--mjl-space-5); }
.mjl-dialog-actions { display: flex; justify-content: flex-end; }

@media (max-width: 900px) {
	.mjl-activity-financial-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.mjl-activity-financial-strip > div { border-bottom: 1px solid rgba(255,255,255,.18); }
}
@media (max-width: 620px) {
	.mjl-activity-financial-strip { grid-template-columns: 1fr; }
	.mjl-activity-financial-strip > div { border-inline-end: 0; }
	.mjl-section-heading { align-items: stretch; flex-direction: column; }
	.mjl-activity-operations-table { min-width: 0; }
	.mjl-activity-operations-table thead { border: 0; clip: rect(0 0 0 0); height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; width: 1px; }
	.mjl-activity-operations-table tr { border: 1px solid var(--mjl-color-border-subtle); display: block; margin-bottom: var(--mjl-space-3); padding: var(--mjl-space-2); }
	.mjl-activity-operations-table td { align-items: baseline; border: 0; display: grid; gap: var(--mjl-space-2); grid-template-columns: minmax(6rem, .8fr) minmax(0, 1.2fr); padding: 6px; }
	.mjl-activity-operations-table td::before { color: var(--mjl-color-text-muted); content: attr(data-label); font-size: 12px; font-weight: 700; }
}
@media (forced-colors: active) {
	.mjl-activity-financial-strip { border: 1px solid CanvasText; }
	.mjl-assignment-avatar { border: 1px solid CanvasText; }
}


/* Review workspace: immutable revision evidence and role-aware decisions. */
.mjl-review-progress {
	display: grid;
	gap: 0;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	list-style: none;
	margin: 0 0 var(--mjl-space-5);
	padding: 0;
}
.mjl-review-stage {
	align-items: center;
	border-bottom: 3px solid var(--mjl-color-border-subtle);
	display: flex;
	gap: var(--mjl-space-3);
	min-width: 0;
	padding: var(--mjl-space-3);
}
.mjl-review-stage > span {
	align-items: center;
	background: var(--mjl-color-surface-subtle);
	border: 1px solid var(--mjl-color-border);
	border-radius: 50%;
	display: inline-flex;
	flex: 0 0 30px;
	font-size: 12px;
	font-weight: 700;
	height: 30px;
	justify-content: center;
}
.mjl-review-stage strong, .mjl-review-stage small { display: block; }
.mjl-review-stage small { color: var(--mjl-color-text-muted); margin-top: 2px; }
.mjl-review-stage-complete { border-bottom-color: var(--mjl-color-status-success); }
.mjl-review-stage-complete > span { background: var(--mjl-color-status-success-badge-surface); border-color: var(--mjl-color-status-success); color: var(--mjl-color-status-success); }
.mjl-review-stage-current { border-bottom-color: var(--mjl-color-action); }
.mjl-review-stage-current > span { background: var(--mjl-color-primary); border-color: var(--mjl-color-primary); color: var(--mjl-color-text-inverse); }
.mjl-review-layout { align-items: start; display: grid; gap: var(--mjl-space-5); grid-template-columns: minmax(0, 1fr) minmax(17rem, 21rem); }
.mjl-review-main { min-width: 0; }
.mjl-review-decision { position: sticky; top: var(--mjl-space-4); }
.mjl-review-decision .mjl-review-form { margin-bottom: var(--mjl-space-3); }
.mjl-review-decision .button { min-height: var(--mjl-touch-target); width: 100%; }
.mjl-review-guidance { color: var(--mjl-color-text-muted); font-size: 13px; }
.mjl-review-description { border-top: 1px solid var(--mjl-color-border-subtle); margin-top: var(--mjl-space-4); padding-top: var(--mjl-space-3); }
.mjl-review-description :where(h3,p) { margin-bottom: 0; }
.mjl-review-form { display: grid; gap: var(--mjl-space-3); }
.mjl-review-form label { display: grid; font-size: 13px; font-weight: 700; gap: var(--mjl-space-1); }
.mjl-review-form textarea { min-height: 7rem; resize: vertical; }
.mjl-modal-dialog { background: transparent; border: 0; max-width: min(620px, calc(100vw - 32px)); padding: 0; width: 100%; }
.mjl-modal-dialog::backdrop { background: var(--mjl-color-overlay); }
.mjl-modal-dialog[open]:not(.mjl-dialog-enhanced) { display: block; margin: var(--mjl-space-5) 0 0; max-width: none; position: static; width: auto; }
.mjl-modal-dialog[open]:not(.mjl-dialog-enhanced) [data-mjl-dialog-close] { display: none; }

@media (max-width: 820px) {
	.mjl-review-layout { grid-template-columns: 1fr; }
	.mjl-review-decision { position: static; }
	.mjl-review-progress { grid-template-columns: 1fr; }
	.mjl-review-stage { border-bottom-width: 1px; border-inline-start: 3px solid var(--mjl-color-border-subtle); }
	.mjl-review-stage-complete { border-inline-start-color: var(--mjl-color-status-success); }
	.mjl-review-stage-current { border-inline-start-color: var(--mjl-color-action); }
}


/* Read-only contextual Operation drawer. */
.mjl-operation-drawer {
	background: transparent;
	border: 0;
	height: 100dvh;
	margin: 0 0 0 auto;
	max-height: 100dvh;
	max-width: min(31rem, 100vw);
	padding: 0;
	width: 100%;
}
.mjl-operation-drawer::backdrop { background: var(--mjl-color-overlay); }
.mjl-operation-drawer-panel {
	background: var(--mjl-color-surface);
	border-inline-start: 1px solid var(--mjl-color-border-subtle);
	box-shadow: var(--mjl-shadow-panel);
	display: flex;
	flex-direction: column;
	min-height: 100%;
}
.mjl-operation-drawer-header {
	align-items: flex-start;
	border-bottom: 1px solid var(--mjl-color-border-subtle);
	display: flex;
	gap: var(--mjl-space-4);
	justify-content: space-between;
	padding: var(--mjl-space-5);
}
.mjl-operation-drawer-header > div { min-width: 0; }
.mjl-operation-drawer-header :where(h2,p) { margin: 0; overflow-wrap: anywhere; }
.mjl-operation-drawer-header h2 { margin-top: var(--mjl-space-1); }
.mjl-operation-drawer-body { flex: 1; overflow: auto; padding: var(--mjl-space-5); }
.mjl-operation-drawer-facts { margin: var(--mjl-space-4) 0 0; }
.mjl-operation-drawer-facts > div {
	border-bottom: 1px solid var(--mjl-color-border-subtle);
	display: grid;
	gap: var(--mjl-space-3);
	grid-template-columns: minmax(9rem, 1fr) minmax(0, 1.4fr);
	padding: var(--mjl-space-3) 0;
}
.mjl-operation-drawer-facts dt { color: var(--mjl-color-text-muted); font-size: 12px; font-weight: 700; }
.mjl-operation-drawer-facts dd { margin: 0; overflow-wrap: anywhere; text-align: end; }
.mjl-operation-drawer-observation { grid-template-columns: 1fr !important; }
.mjl-operation-drawer-observation dd { text-align: start; white-space: pre-wrap; }
.mjl-operation-drawer-footer {
	border-top: 1px solid var(--mjl-color-border-subtle);
	display: flex;
	flex-wrap: wrap;
	gap: var(--mjl-space-3);
	justify-content: flex-end;
	padding: var(--mjl-space-4) var(--mjl-space-5);
}
@media (max-width: 540px) {
	.mjl-operation-drawer { max-width: 100vw; }
	.mjl-operation-drawer-header { padding: var(--mjl-space-4); }
	.mjl-operation-drawer-body { padding: var(--mjl-space-4); }
	.mjl-operation-drawer-facts > div { grid-template-columns: 1fr; gap: var(--mjl-space-1); }
	.mjl-operation-drawer-facts dd { text-align: start; }
	.mjl-operation-drawer-footer { align-items: stretch; flex-direction: column; padding: var(--mjl-space-4); }
	.mjl-operation-drawer-footer .mjl-action { justify-content: center; }
}
@media (forced-colors: active) {
	.mjl-operation-drawer-panel { border-inline-start-color: CanvasText; }
}
.mjl-operation-drawer [hidden] { display: none !important; }


/* Controlled exception requests and decisions. */
.mjl-exception-action { display: inline-flex; margin: var(--mjl-space-2) var(--mjl-space-2) var(--mjl-space-2) 0; }
.mjl-exception-trigger { display: none; }
.mjl-exception-trigger-enhanced { display: inline-flex; }
.mjl-exception-source {
	background: var(--mjl-color-status-warning-surface);
	border: 1px solid var(--mjl-color-status-warning);
	border-radius: var(--mjl-radius-card);
	display: grid;
	gap: var(--mjl-space-4);
	margin: var(--mjl-space-3) 0;
	padding: var(--mjl-space-4);
}
.mjl-exception-source-enhanced { display: none; }
.mjl-exception-inline-copy :where(h3,p) { margin: 0; overflow-wrap: anywhere; }
.mjl-exception-inline-copy p { margin-top: var(--mjl-space-2); }
.mjl-exception-guidance { color: var(--mjl-color-text-muted); }
.mjl-exception-dialog .mjl-dialog-panel {
	display: grid;
	gap: var(--mjl-space-4);
	max-height: min(90dvh, 46rem);
	overflow: auto;
}
.mjl-exception-dialog .mjl-section-heading { border-bottom: 1px solid var(--mjl-color-border-subtle); padding-bottom: var(--mjl-space-4); }
.mjl-exception-dialog .mjl-section-heading > div { min-width: 0; }
.mjl-exception-dialog .mjl-section-heading :where(h2,p) { overflow-wrap: anywhere; }
.mjl-exception-dialog-guidance { margin: 0; }
.mjl-exception-form { display: grid; gap: var(--mjl-space-4); }
.mjl-exception-form label { display: grid; font-size: 13px; font-weight: 700; gap: var(--mjl-space-2); }
.mjl-exception-form textarea { min-height: 8rem; resize: vertical; }
.mjl-exception-form .mjl-dialog-actions { gap: var(--mjl-space-2); }
.mjl-exception-card .mjl-section-heading { align-items: flex-start; }
.mjl-exception-card .mjl-eyebrow { margin-bottom: var(--mjl-space-1); }
.mjl-exception-card .mjl-status-pill { flex: 0 0 auto; }
.mjl-exception-reason {
	background: var(--mjl-color-surface-subtle);
	border-inline-start: 3px solid var(--mjl-color-action);
	padding: var(--mjl-space-3) var(--mjl-space-4);
}
.mjl-exception-reason p { margin: var(--mjl-space-2) 0 0; overflow-wrap: anywhere; }
.mjl-exception-card-actions { display: flex; flex-wrap: wrap; gap: var(--mjl-space-2); }
.mjl-exception-card-actions .mjl-exception-action { margin: 0; }

@media (max-width: 540px) {
	.mjl-exception-action, .mjl-exception-trigger-enhanced { width: 100%; }
	.mjl-exception-trigger-enhanced { justify-content: center; }
	.mjl-exception-dialog .mjl-dialog-panel { max-height: calc(100dvh - 32px); padding: var(--mjl-space-4); }
	.mjl-exception-form .mjl-dialog-actions { align-items: stretch; flex-direction: column; }
	.mjl-exception-form .mjl-dialog-actions .button { width: 100%; }
}
@media (forced-colors: active) {
	.mjl-exception-source, .mjl-exception-reason { border-color: CanvasText; }
}


/* Role dashboards. */
.mjl-dashboard-kpis {
	display: grid;
	gap: var(--mjl-space-3);
	grid-template-columns: repeat(4, minmax(0, 1fr));
	margin: 0 0 var(--mjl-space-2);
}
.mjl-dashboard-freshness {
	color: var(--mjl-color-text-muted);
	font-size: 13px;
	margin: 0 0 var(--mjl-space-5);
}
.mjl-dashboard-kpi,
.mjl-dashboard-panel,
.mjl-admin-dashboard {
	background: var(--mjl-color-surface);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-panel);
	box-shadow: var(--mjl-shadow-card);
	box-sizing: border-box;
}
.mjl-dashboard-kpi {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	min-height: 10rem;
	padding: var(--mjl-space-4);
}
.mjl-dashboard-kpi h2 {
	color: var(--mjl-color-text-muted);
	font-size: 12px;
	font-weight: 700;
	line-height: 1.4;
	margin: 0;
	text-transform: uppercase;
}
.mjl-dashboard-kpi-value {
	color: var(--mjl-color-text);
	display: block;
	font-size: 2rem;
	line-height: 2.5rem;
	margin-top: var(--mjl-space-2);
}
.mjl-dashboard-kpi p {
	color: var(--mjl-color-text-muted);
	font-size: 13px;
	line-height: 1.4;
	margin: var(--mjl-space-1) 0 var(--mjl-space-3);
}
.mjl-dashboard-kpi .mjl-card-link,
.mjl-dashboard-progress-row .mjl-card-link {
	color: var(--mjl-color-action);
	font-weight: 700;
}
.mjl-dashboard-main-grid {
	align-items: start;
	display: grid;
	gap: var(--mjl-space-4);
	grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.85fr);
	margin-bottom: var(--mjl-space-5);
}
.mjl-dashboard-panel { min-width: 0; padding: var(--mjl-space-5); }
.mjl-dashboard-panel .mjl-review-timeline { margin-bottom: 0; }
.mjl-dashboard-progress { display: grid; gap: var(--mjl-space-4); }
.mjl-dashboard-progress-row > div {
	align-items: baseline;
	display: flex;
	gap: var(--mjl-space-3);
	justify-content: space-between;
}
.mjl-dashboard-progress-row progress {
	accent-color: var(--mjl-color-action);
	display: block;
	height: 0.5rem;
	margin-top: var(--mjl-space-2);
	width: 100%;
}
.mjl-dashboard-panel-footnote {
	color: var(--mjl-color-text-muted);
	font-size: 13px;
	margin: var(--mjl-space-4) 0 0;
}
.mjl-dashboard-financial-strip {
	display: grid;
	gap: var(--mjl-space-3);
	grid-template-columns: repeat(4, minmax(0, 1fr));
}
.mjl-dashboard-financial-strip .mjl-dashboard-card { min-height: 10rem; }
.mjl-dashboard-financial-details {
	border-top: 1px solid var(--mjl-color-border-subtle);
	margin-top: var(--mjl-space-4);
	padding-top: var(--mjl-space-3);
}
.mjl-dashboard-financial-details > summary {
	color: var(--mjl-color-action);
	cursor: pointer;
	font-weight: 700;
	min-height: var(--mjl-control-standard);
	padding: var(--mjl-space-2) 0;
}
.mjl-dashboard-financial-details > summary:focus-visible {
	outline: 2px solid var(--mjl-focus-ring);
	outline-offset: 2px;
}
@media (hover: hover) {
	.mjl-dashboard-financial-details > summary:hover { color: var(--mjl-color-primary); text-decoration: underline; }
}
.mjl-dashboard-financial-details > summary:active { color: var(--mjl-color-primary); }
.mjl-dashboard-financial-details > p { color: var(--mjl-color-text-muted); }
.mjl-dashboard-alerts .mjl-action { margin-top: var(--mjl-space-3); }
.mjl-admin-dashboard { padding: var(--mjl-space-5); }
.mjl-admin-dashboard-grid {
	display: grid;
	gap: var(--mjl-space-3);
	grid-template-columns: repeat(2, minmax(0, 1fr));
}
.mjl-admin-dashboard .mjl-nav-card { min-height: 11rem; }
.mjl-admin-dashboard .mjl-nav-card h3 { color: var(--mjl-color-text); margin: 0; }
.mjl-admin-dashboard .mjl-nav-card span { color: var(--mjl-color-text-muted); font-weight: 400; }
.mjl-admin-dashboard .mjl-nav-card-action { color: var(--mjl-color-action); margin-top: auto; }

@media (max-width: 980px) {
	.mjl-dashboard-kpis,
	.mjl-dashboard-financial-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.mjl-dashboard-main-grid { grid-template-columns: 1fr; }
}
@media (max-width: 540px) {
	.mjl-dashboard-kpis,
	.mjl-dashboard-financial-strip,
	.mjl-admin-dashboard-grid { grid-template-columns: 1fr; }
	.mjl-dashboard-kpi { min-height: 0; }
	.mjl-dashboard-panel,
	.mjl-admin-dashboard { padding: var(--mjl-space-4); }
}
@media (forced-colors: active) {
	.mjl-dashboard-kpi,
	.mjl-dashboard-panel,
	.mjl-admin-dashboard { border-color: CanvasText; box-shadow: none; }
	.mjl-dashboard-progress-row progress { forced-color-adjust: auto; }
}


/* Partner and Project reference management. */
.mjl-reference-list {
	background: var(--mjl-color-surface);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-panel);
	box-shadow: var(--mjl-shadow-card);
	overflow: visible;
	padding: var(--mjl-space-4);
}
.mjl-reference-table { margin: 0; }
.mjl-reference-table .mjl-status-pill { margin-top: 0; }
.mjl-reference-table td:last-child { white-space: nowrap; }
.mjl-reference-detail {
	background: var(--mjl-color-surface);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-panel);
	box-shadow: var(--mjl-shadow-card);
	padding: var(--mjl-space-5);
}
.mjl-reference-dialog .mjl-dialog-panel {
	display: grid;
	gap: var(--mjl-space-4);
	max-height: min(90dvh, 44rem);
	overflow: auto;
}
.mjl-reference-dialog .mjl-section-heading {
	align-items: flex-start;
	border-bottom: 1px solid var(--mjl-color-border-subtle);
	display: flex;
	gap: var(--mjl-space-4);
	justify-content: space-between;
	margin: 0;
	padding-bottom: var(--mjl-space-4);
}
.mjl-reference-dialog .mjl-section-heading > div { min-width: 0; }
.mjl-reference-dialog .mjl-section-heading :where(h2, p) { overflow-wrap: anywhere; }
.mjl-reference-dialog .mjl-section-heading h2 { margin: 0; }
.mjl-reference-dialog .mjl-eyebrow { margin: 0 0 var(--mjl-space-1); }
.mjl-reference-form { gap: var(--mjl-space-4); }
.mjl-reference-form :where(input, select) { width: 100%; }
.mjl-reference-form-errors:empty { display: none; }
.mjl-reference-immutable {
	background: var(--mjl-color-surface-subtle);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-card);
	margin: 0;
	padding: var(--mjl-space-3);
}
.mjl-reference-immutable div { display: grid; gap: var(--mjl-space-1); }
.mjl-reference-immutable dt { color: var(--mjl-color-text-muted); font-size: 12px; font-weight: 700; }
.mjl-reference-immutable dd { font-weight: 700; margin: 0; overflow-wrap: anywhere; }
.mjl-reference-lifecycle-trigger { display: none; }
.mjl-reference-lifecycle-trigger-enhanced { display: inline-flex; }
.mjl-reference-lifecycle-source-enhanced > form { display: none; }
.mjl-reference-lifecycle-form { margin-top: var(--mjl-space-4); }
.mjl-reference-lifecycle-guidance { margin: 0; }
.mjl-reference-dialog [data-reference-dialog-form] .mjl-reference-lifecycle-form {
	display: flex;
	justify-content: flex-end;
	margin: 0;
}
@media (max-width: 540px) {
	.mjl-reference-list,
	.mjl-reference-detail,
	.mjl-reference-dialog .mjl-dialog-panel { padding: var(--mjl-space-4); }
	.mjl-reference-dialog .mjl-section-heading { align-items: stretch; flex-direction: column; }
	.mjl-reference-dialog .mjl-section-heading .mjl-action { justify-content: center; width: 100%; }
	.mjl-reference-form .mjl-activity-form-actions { align-items: stretch; flex-direction: column; }
	.mjl-reference-form .mjl-activity-form-actions :where(.button, .mjl-action) { justify-content: center; width: 100%; }
	.mjl-reference-dialog [data-reference-dialog-form] .mjl-reference-lifecycle-form,
	.mjl-reference-dialog [data-reference-dialog-form] .button { width: 100%; }
}
@media (forced-colors: active) {
	.mjl-reference-list,
	.mjl-reference-detail,
	.mjl-reference-dialog .mjl-dialog-panel,
	.mjl-reference-immutable { border-color: CanvasText; box-shadow: none; }
}

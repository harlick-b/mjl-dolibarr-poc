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
	align-items: flex-start;
	--mjl-dolibarr-edge-correction: 7px;
	display: grid;
	gap: var(--mjl-space-6);
	grid-template-columns: 256px minmax(0, 1fr);
	margin-left: calc((100% - 100vw) / 2 - var(--mjl-dolibarr-edge-correction));
	position: relative;
	width: calc(100% + ((100vw - 100%) / 2) + var(--mjl-dolibarr-edge-correction));
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

.mjl-skip-link:focus {
	transform: translateY(0);
}

.mjl-module-main {
	min-width: 0;
}

.mjl-module-main:focus {
	outline: 2px solid var(--mjl-focus-ring);
	outline-offset: var(--mjl-space-1);
}

.mjl-navigation-trigger,
.mjl-navigation-backdrop,
.mjl-navigation-close {
	display: none;
}

.mjl-module-sidebar {
	background: var(--mjl-color-surface);
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: 0;
	box-shadow: none;
	box-sizing: border-box;
	min-height: 100vh;
	padding: var(--mjl-space-4);
	position: sticky;
	top: 0;
}

.mjl-sidebar-title {
	border-bottom: 1px solid var(--mjl-color-border-subtle);
	margin-bottom: var(--mjl-space-3);
	padding-bottom: var(--mjl-space-3);
}

.mjl-sidebar-title span {
	color: var(--mjl-color-text-muted);
	display: block;
	font-size: 12px;
	font-weight: 700;
	margin-bottom: var(--mjl-space-1);
	text-transform: uppercase;
}

.mjl-sidebar-title strong {
	color: var(--mjl-color-primary);
	display: block;
	font-size: 15px;
	line-height: 1.25;
}

.mjl-sidebar-nav {
	display: grid;
	gap: var(--mjl-space-4);
}

.mjl-sidebar-section,
.mjl-sidebar-items {
	display: grid;
	gap: var(--mjl-space-1);
	min-width: 0;
}

.mjl-sidebar-category {
	color: var(--mjl-color-text-muted);
	font-size: 11px;
	font-weight: 700;
	line-height: 1.3;
	margin: 0 0 var(--mjl-space-1);
	text-transform: uppercase;
}

.mjl-sidebar-link {
	border: 1px solid transparent;
	border-radius: var(--mjl-radius-card);
	box-sizing: border-box;
	color: var(--mjl-color-text-secondary);
	display: grid;
	gap: var(--mjl-space-1);
	padding: 10px var(--mjl-space-3);
	text-decoration: none;
}

.mjl-sidebar-link span {
	color: var(--mjl-color-primary);
	font-size: 14px;
	font-weight: 700;
	line-height: 1.25;
}

.mjl-sidebar-link small {
	color: var(--mjl-color-text-muted);
	font-size: 12px;
	line-height: 1.25;
}

.mjl-sidebar-link-active {
	background: var(--mjl-color-surface-selected);
	border-color: var(--mjl-color-border);
}

.mjl-sidebar-children {
	border-left: 2px solid var(--mjl-color-border-subtle);
	display: grid;
	gap: var(--mjl-space-1);
	margin: 2px 0 var(--mjl-space-2) var(--mjl-space-3);
	padding-left: var(--mjl-space-2);
}

.mjl-sidebar-child-link {
	border-radius: var(--mjl-radius-control);
	color: var(--mjl-color-text-secondary);
	display: block;
	font-size: 12px;
	line-height: 1.25;
	padding: var(--mjl-space-2);
	text-decoration: none;
}

.mjl-sidebar-child-link-active {
	background: var(--mjl-color-surface-selected);
	color: var(--mjl-color-primary);
}

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

.mjl-activity-form-actions {
	align-self: end;
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

.mjl-table-filters select {
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

	.mjl-sidebar-nav {
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
	}

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

	.mjl-sidebar-link,
	.mjl-sidebar-child-link,
	.mjl-action {
		display: grid;
	}
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

.mjl-activity-form fieldset {
	border: 1px solid var(--mjl-color-border-subtle);
	border-radius: var(--mjl-radius-card);
	margin: 0 0 var(--mjl-space-5);
	padding: var(--mjl-space-4);
}

.mjl-activity-form legend { font-weight: 700; padding: 0 var(--mjl-space-2); }
.mjl-form-grid { display: grid; gap: var(--mjl-space-3); grid-template-columns: minmax(10rem, 1fr) minmax(16rem, 2fr); }
.mjl-operation-row { align-items: end; border-bottom: 1px solid var(--mjl-color-border-subtle); display: grid; gap: var(--mjl-space-3); grid-template-columns: 2fr 1.25fr 1fr auto; padding: var(--mjl-space-3) 0; }
.mjl-operation-row label { display: grid; gap: var(--mjl-space-1); }
.mjl-activity-totals { display: grid; gap: var(--mjl-space-3); grid-template-columns: repeat(3, 1fr); }
.mjl-activity-totals div { background: var(--mjl-color-surface-subtle); border-radius: var(--mjl-radius-card); padding: var(--mjl-space-3); }
.mjl-activity-totals dt { color: var(--mjl-color-text-muted); }
.mjl-activity-totals dd { font-size: 1.1rem; font-weight: 700; margin: var(--mjl-space-1) 0 0; }
.mjl-revision-summary { max-height: 32rem; overflow: auto; white-space: pre-wrap; }

@media (max-width: 768px) {
	.mjl-form-grid, .mjl-operation-row, .mjl-activity-totals { grid-template-columns: 1fr; }
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

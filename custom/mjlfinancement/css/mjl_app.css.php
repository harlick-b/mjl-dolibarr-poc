<?php
header('Content-Type: text/css; charset=UTF-8');
?>
.mjl-workspace {
	color: #202529;
	font-family: Arial, Helvetica, sans-serif;
}

.mjl-module-shell {
	align-items: flex-start;
	display: grid;
	gap: 18px;
	grid-template-columns: minmax(180px, 230px) minmax(0, 1fr);
}

.mjl-module-main {
	min-width: 0;
}

.mjl-module-sidebar {
	background: #ffffff;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	box-shadow: 0 6px 16px rgba(32, 37, 41, 0.05);
	box-sizing: border-box;
	padding: 14px;
	position: sticky;
	top: 12px;
}

.mjl-sidebar-title {
	border-bottom: 1px solid #d7dee2;
	margin-bottom: 10px;
	padding-bottom: 10px;
}

.mjl-sidebar-title span {
	color: #5c6870;
	display: block;
	font-size: 12px;
	font-weight: 700;
	margin-bottom: 4px;
	text-transform: uppercase;
}

.mjl-sidebar-title strong {
	color: #16324f;
	display: block;
	font-size: 15px;
	line-height: 1.25;
}

.mjl-sidebar-nav {
	display: grid;
	gap: 6px;
}

.mjl-sidebar-link {
	border: 1px solid transparent;
	border-radius: 6px;
	box-sizing: border-box;
	color: #34414a;
	display: grid;
	gap: 3px;
	padding: 9px 10px;
	text-decoration: none;
}

.mjl-sidebar-link span {
	color: #16324f;
	font-size: 14px;
	font-weight: 700;
	line-height: 1.25;
}

.mjl-sidebar-link small {
	color: #5c6870;
	font-size: 12px;
	line-height: 1.25;
}

.mjl-sidebar-link:hover,
.mjl-sidebar-link-active {
	background: #f5f7f8;
	border-color: #c5ced4;
}

.mjl-workspace-header {
	align-items: flex-start;
	background: #ffffff;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	box-shadow: 0 8px 22px rgba(32, 37, 41, 0.06);
	display: flex;
	gap: 24px;
	justify-content: space-between;
	margin-bottom: 18px;
	padding: 24px;
}

.mjl-kicker {
	color: #5c6870;
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0;
	margin: 0 0 6px;
	text-transform: uppercase;
}

.mjl-workspace h1,
.mjl-workspace h2 {
	color: #16324f;
	letter-spacing: 0;
	margin: 0;
}

.mjl-workspace h1 {
	font-size: 26px;
	line-height: 1.2;
}

.mjl-workspace h2 {
	font-size: 18px;
	line-height: 1.3;
}

.mjl-header-copy,
.mjl-section-heading p,
.mjl-dashboard-card p,
.mjl-nav-card span {
	color: #5c6870;
	font-size: 14px;
	line-height: 1.45;
}

.mjl-header-copy {
	margin: 8px 0 0;
	max-width: 720px;
}

.mjl-user-context {
	background: #f5f7f8;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	min-width: 190px;
	padding: 12px 14px;
}

.mjl-user-context span,
.mjl-card-label {
	color: #5c6870;
	display: block;
	font-size: 12px;
	font-weight: 700;
	margin-bottom: 5px;
	text-transform: uppercase;
}

.mjl-user-context strong {
	color: #202529;
	display: block;
	font-size: 14px;
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

.mjl-dashboard-card-warning {
	border-left: 4px solid #b56b00;
}

.mjl-dashboard-card-danger {
	border-left: 4px solid #b42318;
}

.mjl-card-value {
	color: #16324f;
	display: block;
	font-size: 30px;
	line-height: 1.1;
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

.mjl-status-pill {
	border: 1px solid #c5ced4;
	border-radius: 999px;
	color: #34414a;
	display: inline-block;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.2;
	margin-top: 10px;
	padding: 5px 9px;
}

.mjl-status-warning {
	background: #fff4df;
	border-color: #d99a2b;
	color: #6f4200;
}

.mjl-status-danger {
	background: #fff0ed;
	border-color: #e08a80;
	color: #8a1f15;
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
	min-height: 34px;
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
	min-height: 34px;
	width: 100%;
}

.mjl-activity-form-actions {
	align-self: end;
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
.mjl-sidebar-link:focus {
	outline: 3px solid #7fb3d5;
	outline-offset: 2px;
}

@media (max-width: 980px) {
	.mjl-module-shell {
		display: block;
	}

	.mjl-module-sidebar {
		margin-bottom: 16px;
		position: static;
	}

	.mjl-sidebar-nav {
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}
}

@media (max-width: 720px) {
	.mjl-workspace-header {
		display: block;
		padding: 18px;
	}

	.mjl-user-context {
		margin-top: 14px;
		min-width: 0;
	}

	.mjl-activity-detail-grid {
		grid-template-columns: 1fr;
	}
}

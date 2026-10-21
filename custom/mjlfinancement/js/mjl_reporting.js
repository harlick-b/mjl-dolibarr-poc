/* Dashboard, alert, audit and report screens backed only by REST. */
(function () {
  "use strict";
  const app = document.getElementById("mjl-reporting-app");
  if (!app || !window.mjlApi) return;
  const screen = app.dataset.screen,
    base = app.dataset.base,
    params = new URLSearchParams(location.search);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const labels = {
    DRAFT: "Brouillon",
    SUBMITTED: "Soumise",
    PREVALIDATED: "Prévalidée",
    RETURNED_SUPERVISOR: "Retournée par le superviseur",
    RETURNED_VALIDATOR: "Retournée par le validateur",
    FINAL_VALIDATED: "Validée définitivement",
    CANCELLED: "Annulée",
    ABANDONED: "Abandonnée",
    NOT_STARTED: "Non commencée",
    UPCOMING: "À venir",
    IN_PROGRESS: "En cours",
    OVERDUE: "En retard",
    COMPLETED: "Terminée",
    PARTIAL: "Partielle",
    COMPLETE: "Complète",
    TODO: "À faire",
    SUCCESS: "Réussite",
    DENIED: "Refus",
    FAILED: "Échec",
  };
  const money = (value) =>
    value === null
      ? "Non renseigné"
      : new Intl.NumberFormat("fr-FR").format(BigInt(value)) + " FCFA";
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat("fr-FR").format(
          new Date(value.length === 10 ? value + "T00:00:00" : value),
        )
      : "Non renseignée";
  const dateTime = (value) =>
    value
      ? new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "medium",
          timeStyle: "medium",
          timeZone: "Africa/Porto-Novo",
        }).format(new Date(value))
      : "Non renseignée";
  const state = (title, message) =>
    `<div class="mjl-system-state"><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`;
  function pageUrl(path, changes = {}) {
    const query = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) =>
      value === "" || value === null
        ? query.delete(key)
        : query.set(key, value),
    );
    return base + "/" + path + (query.size ? "?" + query : "");
  }
  function apiQuery(excluded = []) {
    const query = new URLSearchParams(params);
    excluded.concat(["report"]).forEach((key) => query.delete(key));
    return query;
  }
  function exportFilters() {
    const filters = {};
    params.forEach((value, key) => {
      if (!["report", "page", "cursor"].includes(key)) filters[key] = value;
    });
    return filters;
  }
  function select(name, label, rows, settings = {}) {
    const current = params.get(name) ?? settings.defaultValue ?? "";
    const all =
      settings.allowAll === false ? "" : '<option value="">Tous</option>';
    const known = rows.some((row) => String(row.id ?? row) === current);
    const missing =
      current && !known
        ? `<option selected value="${esc(current)}">Référence hors sélection</option>`
        : "";
    return `<label><span>${esc(label)}</span><select name="${name}">${all}${missing}${rows
      .map((row) => {
        const value = String(row.id ?? row),
          text = row.label ?? labels[value] ?? value;
        return `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(text)}</option>`;
      })
      .join("")}</select></label>`;
  }
  function filterForm(options, type = "activities") {
    if (type === "audit") {
      const fields = {
        q: "Référence ou nom historique de l’acteur",
        event_id: "Identifiant événement",
        object_type: "Type d’objet",
        object_id: "Identifiant objet",
        activity_id: "Identifiant Activité",
        operation_id: "Identifiant Opération",
        revision_id: "Identifiant révision",
        target_version: "Version cible",
        actor_id: "Identifiant acteur",
        audit_action: "Code action",
      };
      const inputs = Object.entries(fields)
        .map(
          ([name, label]) =>
            `<label><span>${label}</span><input name="${name}" maxlength="100" value="${esc(params.get(name) || "")}"></label>`,
        )
        .join("");
      return `<details class="mjl-workspace-section"><summary>Filtrer le journal</summary><form method="GET" class="mjl-activity-form"><div class="mjl-form-grid">${inputs}${select("result", "Résultat", ["SUCCESS", "DENIED", "FAILED"])}${select(
        "direction",
        "Ordre",
        [
          { id: "desc", label: "Plus récents en premier" },
          { id: "asc", label: "Plus anciens en premier" },
        ],
        { allowAll: false, defaultValue: "desc" },
      )}<label><span>À partir du</span><input name="date_from" type="date" value="${esc(params.get("date_from") || "")}"></label><label><span>Jusqu’au</span><input name="date_to" type="date" value="${esc(params.get("date_to") || "")}"></label>${params.get("report") ? '<input type="hidden" name="report" value="audit">' : ""}</div><button class="button" type="submit">Appliquer les filtres</button></form></details>`;
    }
    if (type === "activity_detail")
      return `<section class="mjl-workspace-section"><p><a href="${esc(base + "/activities.php?id=" + encodeURIComponent(params.get("activity_id")))}">Retour à l’Activité</a></p><input type="hidden" name="activity_id" value="${esc(params.get("activity_id"))}"></section>`;
    const operation = type === "operations";
    const refs = options
      ? select("partner_id", "Partenaire", options.partner_id || []) +
        select("project_id", "Projet", options.project_id || [])
      : "";
    const typeFilter =
      operation && options
        ? select("type_id", "Type d’opération", options.type_id || [])
        : "";
    const states =
      select("validation_status", "État de validation", [
        "DRAFT",
        "SUBMITTED",
        "PREVALIDATED",
        "RETURNED_SUPERVISOR",
        "RETURNED_VALIDATOR",
        "FINAL_VALIDATED",
        "CANCELLED",
        "ABANDONED",
      ]) +
      select("execution_status", "État d’exécution", [
        "NOT_STARTED",
        "UPCOMING",
        "IN_PROGRESS",
        "OVERDUE",
        "COMPLETED",
        "CANCELLED",
      ]) +
      select("completeness", "Complétude des dépenses", [
        { id: "NOT_STARTED", label: "Non renseignée" },
        "PARTIAL",
        "COMPLETE",
      ]) +
      (operation
        ? select("operation_status", "État de l’Opération", [
            "TODO",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED",
          ])
        : "");
    const grouping =
      type === "portfolio"
        ? select(
            "grouping",
            "Regroupement",
            [
              { id: "project", label: "Par Projet" },
              { id: "partner", label: "Par Partenaire" },
            ],
            { allowAll: false, defaultValue: "project" },
          )
        : "";
    const hidden =
      (params.get("report")
        ? `<input type="hidden" name="report" value="${esc(params.get("report"))}">`
        : "") +
      (params.get("activity_id")
        ? `<input type="hidden" name="activity_id" value="${esc(params.get("activity_id"))}">`
        : "");
    return `<details class="mjl-workspace-section"><summary>Filtrer la sélection</summary><form method="GET" class="mjl-activity-form"><div class="mjl-form-grid"><label><span>Recherche d’Activité</span><input name="q" type="search" maxlength="100" value="${esc(params.get("q") || "")}"></label><label><span>Période à partir du</span><input name="date_from" type="date" value="${esc(params.get("date_from") || "")}"></label><label><span>Période jusqu’au</span><input name="date_to" type="date" value="${esc(params.get("date_to") || "")}"></label>${refs}${typeFilter}${grouping}${states}${hidden}</div><button class="button" type="submit">Appliquer les filtres</button> <a href="${esc(location.pathname + (params.get("report") ? "?report=" + encodeURIComponent(params.get("report")) : ""))}">Réinitialiser</a></form></details>`;
  }
  function itemUrl(row, alert) {
    if (alert)
      return row.operation_id
        ? `${base}/operations.php?activity_id=${encodeURIComponent(row.activity_id)}#operation-${encodeURIComponent(row.operation_id)}`
        : `${base}/activities.php?id=${encodeURIComponent(row.activity_id)}`;
    if (row.request_id)
      return `${base}/operationrequests.php?type=${encodeURIComponent(row.request_type)}&request_id=${encodeURIComponent(row.request_id)}`;
    if (row.operation_id)
      return `${base}/operations.php?activity_id=${encodeURIComponent(row.activity_id)}#operation-${encodeURIComponent(row.operation_id)}`;
    const action = row.allowed_actions.includes("edit")
      ? "&action=edit"
      : row.allowed_actions.includes("review")
        ? "&action=review"
        : "";
    return `${base}/activities.php?id=${encodeURIComponent(row.activity_id)}${action}`;
  }
  function items(rows, kind) {
    const alert = kind === "alert";
    if (!rows?.length)
      return state(
        alert ? "Aucune alerte" : "Aucune action à traiter",
        "Aucun élément ne correspond à la sélection et à vos accès.",
      );
    return `<ol class="mjl-review-timeline">${rows.map((row) => `<li ${alert ? `data-alert="${esc(row.code)}"` : `data-work="${esc([row.activity_id, row.operation_id, row.request_id].filter(Boolean).join("-"))}"`}><strong>${esc(row.label)}</strong><p>${esc(row.reference)}</p><p>${alert ? (row.actionable ? "Action disponible pour votre profil. " : "Information de suivi. ") : ""}Date : ${esc(date(row.date))}</p><a href="${esc(itemUrl(row, alert))}">Ouvrir</a></li>`).join("")}</ol>`;
  }
  function pagination(value, path, label) {
    if (!value || (value.page === 1 && !value.has_next)) return "";
    const links = [];
    if (value.page > 1)
      links.push(
        `<a class="mjl-action mjl-action-secondary" rel="prev" href="${esc(pageUrl(path, { page: String(value.page - 1) }))}">Précédent</a>`,
      );
    if (value.has_next)
      links.push(
        `<a class="mjl-action mjl-action-secondary" rel="next" href="${esc(pageUrl(path, { page: String(value.page + 1) }))}">Suivant</a>`,
      );
    return `<nav class="mjl-pagination" aria-label="${esc(label)}">${links.join(" ")}</nav>`;
  }
  function reportTable(document) {
    const meta = Object.entries(document.metadata || {})
      .map(
        ([key, value]) => `<p><strong>${esc(key)} :</strong> ${esc(value)}</p>`,
      )
      .join("");
    return (
      meta +
      (document.sections || [])
        .map(
          (section) =>
            `<section class="mjl-workspace-section"><h2>${esc(section.title)}</h2><div class="div-table-responsive-no-min"><table class="noborder centpercent"><thead><tr>${section.headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${section.rows
              .map(
                (row) =>
                  `<tr>${row
                    .map((cell) => {
                      const value =
                        cell.value === null
                          ? "Non renseigné"
                          : cell.type === "ratio"
                            ? cell.value.display
                            : cell.currency
                              ? money(cell.value)
                              : cell.value;
                      return `<td>${esc(value)}</td>`;
                    })
                    .join("")}</tr>`,
              )
              .join("")}</tbody></table></div></section>`,
        )
        .join("")
    );
  }
  function exportForm() {
    return '<form data-export class="mjl-report-export-actions"><label>Format <select name="format"><option value="pdf">PDF</option><option value="xlsx">XLSX</option><option value="csv">CSV</option></select></label><button class="button" type="submit">Télécharger</button><p role="alert" data-error></p></form>';
  }
  async function getOptions() {
    try {
      return {
        data: (await mjlApi.request("/monitoring-options")).data,
        error: false,
      };
    } catch (_) {
      return { data: null, error: true };
    }
  }
  async function loadDashboard(alertsOnly) {
    const query = apiQuery();
    const [value, external, session] = await Promise.all([
      mjlApi.request(
        (alertsOnly ? "/alerts" : "/dashboard") +
          (query.size ? "?" + query : ""),
      ),
      alertsOnly ? getOptions() : Promise.resolve(null),
      mjlApi.request("/auth/session"),
    ]);
    const options = alertsOnly ? external.data : value.data.filter_options;
    const filterState = (alertsOnly ? external.error : options === null)
      ? state(
          "Filtres indisponibles",
          "Les références ne peuvent pas être chargées.",
        )
      : filterForm(options);
    if (alertsOnly) {
      app.innerHTML = `<h1>Alertes</h1>${filterState}<p>${esc(value.total_count)} alerte(s) dans la sélection.</p>${items(value.data, "alert")}${pagination(value.pagination, "alerts.php", "Pagination des alertes")}`;
      return;
    }
    const data = value.data,
      role = session.data.user.role;
    const profiles = {
      AGENT_SAISIE: {
        scope: "Mes Activités",
        work: "Mes actions à traiter",
        metric: "Actions disponibles",
        hint: "Actions actuellement permises pour votre profil.",
      },
      AGENT_VERIFICATEUR: {
        scope: "Activités du portefeuille",
        work: "Prévalidations à traiter",
        metric: "Prévalidations accessibles",
        hint: "Décisions actuellement permises selon la révision et ses contributeurs.",
      },
      VALIDATEUR_DEFINITIF: {
        scope: "Activités du portefeuille",
        work: "Décisions à traiter",
        metric: "Décisions accessibles",
        hint: "Validations, exceptions et restaurations actuellement permises.",
      },
    };
    const profile = profiles[role] || profiles.AGENT_SAISIE,
      total = Number(data.financial.activity_count);
    const activityUrl = (changes) =>
      pageUrl("activities.php", { ...changes, page: "1" });
    const kpis = [
      [
        "scope",
        profile.scope,
        String(total),
        role === "AGENT_SAISIE"
          ? "Périmètre de vos affectations courantes."
          : "Périmètre de l’entité active.",
        activityUrl({}),
      ],
      [
        "work",
        profile.metric,
        data.work_count === null ? "—" : String(data.work_count),
        data.work_count === null
          ? "Les autorisations ne peuvent pas être chargées."
          : profile.hint,
        "#mjl-dashboard-work",
      ],
      [
        "in-progress",
        "En cours",
        String(data.execution_counts.IN_PROGRESS),
        "Activités dont l’exécution est en cours.",
        activityUrl({ execution_status: "IN_PROGRESS" }),
      ],
      [
        "overdue",
        "En retard",
        String(data.execution_counts.OVERDUE),
        "Activités dont la date de fin est dépassée.",
        activityUrl({ execution_status: "OVERDUE" }),
      ],
    ];
    const kpiHtml = `<section class="mjl-dashboard-kpis" aria-label="Indicateurs du tableau de bord">${kpis.map((card) => `<article class="mjl-dashboard-kpi" data-dashboard-kpi="${card[0]}"><div><h2>${esc(card[1])}</h2><strong class="mjl-dashboard-kpi-value">${esc(card[2])}</strong><p>${esc(card[3])}</p></div><a class="mjl-card-link" href="${esc(card[4])}">Consulter</a></article>`).join("")}</section>`;
    const progress = Object.entries(data.execution_counts)
      .map(
        ([status, count]) =>
          `<div class="mjl-dashboard-progress-row"><div><a class="mjl-card-link" href="${esc(activityUrl({ execution_status: status }))}">${esc(labels[status] || status)}</a><strong>${esc(count)}</strong></div><progress max="${total}" value="${esc(count)}" aria-label="${esc((labels[status] || status) + " : " + count + " sur " + total + " Activités")}">${esc(count)} sur ${total}</progress></div>`,
      )
      .join("");
    const financialLabels = {
      initial_amount: "Propositions initiales soumises",
      pending_amount: "Propositions courantes non validées",
      validated_amount: "Montants validés",
      active_authorized_amount: "Autorisations actives",
      cancelled_authorized_amount: "Autorisations annulées",
      active_spent_amount: "Dépenses approuvées actives",
      cancelled_spent_amount: "Dépenses approuvées annulées",
      total_spent_amount: "Dépenses approuvées",
      activity_count: "Activités",
      operation_count: "Opérations",
      missing_spent_count: "Situations financières non approuvées",
      cancelled_incomplete_count: "Opérations annulées non approuvées",
      pending_draft_amount: "Propositions en brouillon ou retournées",
      pending_submitted_amount: "Propositions soumises ou prévalidées",
    };
    const reportUrl = pageUrl("reports.php", {
      report: "portfolio",
      page: null,
    });
    const primary = [
      "validated_amount",
      "active_authorized_amount",
      "total_spent_amount",
      "missing_spent_count",
    ];
    const cards = (keys) =>
      keys
        .map(
          (key) =>
            `<article class="mjl-dashboard-card" data-metric="${key}"><h3>${esc(financialLabels[key])}</h3><strong>${key.endsWith("_count") ? esc(data.financial[key]) : money(data.financial[key])}</strong><a class="mjl-card-link" href="${esc(reportUrl)}">Consulter le portefeuille</a></article>`,
        )
        .join("");
    const stages = Object.entries(data.validation_counts)
      .map(
        ([status, count]) =>
          `<li><a href="${esc(activityUrl({ validation_status: status }))}">${esc(labels[status] || status)} : ${esc(count)}</a></li>`,
      )
      .join("");
    app.innerHTML = `<h1>Tableau de bord</h1>${filterState}<p>Calcul au ${esc(date(data.calculated_on))} (Africa/Porto-Novo).</p>${kpiHtml}<div class="mjl-dashboard-main-grid"><section id="mjl-dashboard-work" class="mjl-dashboard-panel"><h2>${esc(profile.work)}</h2><p>${data.work_count === null ? "Nombre indisponible" : esc(data.work_count) + " action(s) dans la sélection."}</p>${data.work_items === null ? state("Actions indisponibles", "Les autorisations de traitement ne peuvent pas être chargées.") : items(data.work_items, "work")}${pagination(data.pagination, "index.php", "Pagination des actions")}</section><section class="mjl-dashboard-panel"><h2>Avancement des Activités</h2>${total ? `<div class="mjl-dashboard-progress">${progress}</div>` : state("Aucune Activité", "Aucun avancement ne correspond à la sélection et à vos accès.")}</section></div><section class="mjl-dashboard-financial"><h2>Situation financière</h2><p>Seules les dépenses approuvées sont comptabilisées. Les montants manquants ne sont jamais remplacés par zéro.</p><div class="mjl-dashboard-financial-strip">${cards(primary)}</div><details><summary>Voir les indicateurs financiers complémentaires</summary><div class="mjl-card-grid">${cards(Object.keys(data.financial).filter((key) => !primary.includes(key)))}</div></details></section><section class="mjl-workspace-section"><h2>Étapes de validation</h2><ul class="mjl-link-grid">${stages}</ul></section><section class="mjl-workspace-section"><h2>Alertes de suivi</h2>${items(data.alerts, "alert")}<a href="${esc(pageUrl("alerts.php", { page: "1" }))}">Voir toutes les alertes (${esc(data.alert_count)})</a></section>`;
  }
  function auditRows(rows) {
    if (!rows.length)
      return state(
        "Aucun événement",
        "Aucun événement ne correspond aux filtres.",
      );
    const value = (entry) =>
      entry === null || entry === "" ? "Non renseigné" : entry;
    const metadata = (event) => [
      ["Identifiant événement", event.id],
      ["Entité", event.entity],
      ["Type d’objet", event.object_type],
      ["Identifiant objet", event.object_id],
      ["Référence historique", event.object_ref],
      ["Activité", event.activity_id],
      ["Opération", event.operation_id],
      ["Révision", event.revision_id],
      ["Version cible", event.target_version],
      ["Identifiant acteur", event.actor_id],
      ["Nom historique de l’acteur", event.actor_name],
      ["Rôle enregistré", event.actor_role],
      ["Date et heure", dateTime(event.event_at)],
      ["Code action", event.action],
      ["État avant", event.state_before],
      ["État après", event.state_after],
      ["Motif", event.reason],
      ["Résultat", labels[event.result] || event.result],
    ];
    const detail = (change) => [
      ["Chemin du champ", change.path],
      ["Champ", change.field_label],
      ["Nature du détail", change.kind],
      ["Partie", change.part],
      ["Nombre de parties", change.parts],
      ["Type avant", change.before_type],
      ["Avant", change.before],
      ["Type après", change.after_type],
      ["Après", change.after],
    ];
    const facts = (entries, className) =>
      `<dl class="${className}">${entries.map(([label, entry]) => `<div><dt>${esc(label)}</dt><dd>${esc(value(entry))}</dd></div>`).join("")}</dl>`;
    return `<ol class="mjl-review-timeline mjl-audit-timeline">${rows.map((event) => `<li data-audit-event-id="${esc(event.id)}"><article class="mjl-activity-panel mjl-audit-event"><header><h3>${esc(event.action_label)}</h3><p>${esc((event.actor_name || "Système") + " · " + (event.actor_role || "Rôle non renseigné"))}</p><time datetime="${esc(event.event_at)}">${esc(dateTime(event.event_at))}</time></header>${facts(metadata(event), "mjl-audit-event-meta")}${event.detail_status === "available" ? `<details class="mjl-audit-event-details"><summary>Champs et valeurs enregistrés</summary>${event.changes.map((change) => facts(detail(change), "mjl-audit-change-grid")).join("")}</details>` : '<p role="status">Détails indisponibles : cet événement ne peut pas être représenté dans cet aperçu.</p>'}</article></li>`).join("")}</ol>`;
  }
  function auditPagination(value) {
    if (!params.get("cursor") && !value.has_next) return "";
    const path = screen === "audit" ? "workflowactions.php" : "reports.php";
    const links = [];
    if (params.get("cursor"))
      links.push(
        `<a class="mjl-action mjl-action-secondary" href="${esc(pageUrl(path, { cursor: "" }))}">Première page</a>`,
      );
    if (value.has_next)
      links.push(
        `<a class="mjl-action mjl-action-secondary" rel="next" href="${esc(pageUrl(path, { cursor: value.next_cursor }))}">Suivant</a>`,
      );
    return `<nav class="mjl-report-pagination" aria-label="Pagination du journal">${links.join(" ")}</nav>`;
  }
  async function loadAudit() {
    const query = apiQuery();
    const value = await mjlApi.request(
      "/audit-events" + (query.size ? "?" + query : ""),
    );
    app.innerHTML = `<h1>Journal d’audit</h1>${filterForm(null, "audit")}${exportForm()}${auditRows(value.data)}${auditPagination(value.pagination)}`;
    bindExport("audit");
  }
  async function loadReport() {
    const type = params.get("report") || "activities";
    if (type === "audit") {
      await loadAudit();
      return;
    }
    if (
      !["activities", "operations", "activity_detail", "portfolio"].includes(
        type,
      )
    )
      throw new Error("Type de rapport non reconnu.");
    if (type === "activity_detail" && !params.get("activity_id"))
      throw new Error("Sélectionnez une Activité avant d’ouvrir sa fiche.");
    const query = apiQuery(["page", "cursor"]);
    const [value, options, session] = await Promise.all([
      mjlApi.request("/reports/" + type + (query.size ? "?" + query : "")),
      getOptions(),
      mjlApi.request("/auth/session"),
    ]);
    const tabs = [
      ["activities", "Activités"],
      ["operations", "Opérations"],
      ["portfolio", "Portefeuille"],
    ];
    if (params.get("activity_id"))
      tabs.splice(2, 0, ["activity_detail", "Fiche Activité"]);
    if (session.data.allowed_actions.includes("listAuditEvents"))
      tabs.push(["audit", "Audit"]);
    const filterState = options.error
      ? state(
          "Filtres indisponibles",
          "Les références ne peuvent pas être chargées.",
        )
      : filterForm(options.data, type);
    app.innerHTML = `<h1>Rapports</h1><nav class="mjl-tabs" aria-label="Rapports">${tabs.map(([value, label]) => `<a href="?report=${value}${value === "activity_detail" ? "&activity_id=" + encodeURIComponent(params.get("activity_id")) : ""}"${value === type ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>${filterState}<section class="mjl-workspace-section mjl-report-export-panel"><h2>Téléchargement</h2><p>L’aperçu est une capture ; le téléchargement utilise une nouvelle capture complète.</p>${exportForm()}</section>${reportTable(value.data)}`;
    bindExport(type);
  }
  function bindExport(type) {
    const form = app.querySelector("[data-export]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button"),
        error = form.querySelector("[data-error]");
      button.disabled = true;
      error.textContent = "";
      try {
        await mjlApi.download("/reports/" + type + "/exports", {
          format: new FormData(form).get("format"),
          filters: exportFilters(),
        });
        button.disabled = false;
      } catch (exception) {
        error.textContent = exception.message;
        if (exception.code !== "outcome_unknown") button.disabled = false;
      }
    });
  }
  async function start() {
    app.querySelector("[data-mjl-js-required]")?.remove();
    const loading = app.querySelector("[data-loading]");
    if (loading) loading.hidden = false;
    try {
      if (screen === "home") await loadDashboard(false);
      else if (screen === "alerts") await loadDashboard(true);
      else if (screen === "audit") await loadAudit();
      else await loadReport();
    } catch (error) {
      app.innerHTML = `<h1>Service indisponible</h1>${state("Chargement impossible", error.message)}`;
    }
  }
  start();
})();

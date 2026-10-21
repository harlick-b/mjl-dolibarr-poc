(function () {
 'use strict';
 async function init() {
  const app = document.getElementById('mjl-references-app');
  if (!app) return;
  app.querySelector('[data-mjl-js-required]')?.remove();
  app.querySelector('[data-loading]').hidden = false;
  const config = JSON.parse(app.dataset.reference);
  const route = app.dataset.base + '/' + config.route + '.php';
  const endpoint = '/' + config.api;
  const query = new URLSearchParams(location.search);
  const id = query.get('id'), action = query.get('action') || '';
  const project = config.operation === 'Project';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const badge = row => `<span class="mjl-status-pill mjl-status-${row.active ? 'success' : 'neutral'}">${row.active ? 'Actif' : 'Inactif'}</span>`;
  function error(message, host = app) {
   let box = host.querySelector('[data-api-error]');
   if (!box) {
    box = document.createElement('div'); box.dataset.apiError = '';
    box.className = 'mjl-system-state mjl-system-state-error';
    box.setAttribute('role', 'alert'); box.tabIndex = -1; host.prepend(box);
   }
   box.textContent = message; box.focus();
  }
  try {
   if ((id && !/^[1-9][0-9]*$/.test(id)) || !['','create','edit'].includes(action) || (action === 'edit' && !id) || (action === 'create' && id)) throw new Error('Adresse non valide.');
   const session = (await mjlApi.request('/auth/session')).data;
   const manage = session.allowed_actions.includes('create' + config.operation);
   if (action && !manage) throw new Error('Action non autorisée.');
   const row = id ? (await mjlApi.request(endpoint + '/' + id)).data : null;
   let parentField = '';
   if (project && action === 'create') {
    const partners = [];
    let page = 1, result;
    do {
     result = await mjlApi.request('/partners?page=' + page++);
     partners.push(...result.data.filter(p => p.active));
    } while (result.pagination.has_next);
    parentField = `<div class="mjl-form-field"><label for="reference-parent">Partenaire <span aria-hidden="true">*</span></label>
     <select id="reference-parent" name="partner_id" required aria-describedby="reference-parent-help"><option value="">Sélectionner</option>
     ${partners.map(p => `<option value="${p.id}">${escape(p.label)}</option>`).join('')}</select>
     <p id="reference-parent-help">Le Partenaire du Projet ne pourra plus être modifié après sa création.${partners.length ? '' : ' Aucun Partenaire actif disponible.'}</p></div>`;
   } else if (project && action === 'edit') {
    parentField = `<dl class="mjl-reference-immutable"><div><dt>Partenaire</dt><dd>${escape(row.partner_label)}</dd></div></dl>`;
   }
   app.innerHTML = `<header class="mjl-page-header" aria-labelledby="mjl-page-title"><div class="mjl-page-header-layout"><div class="mjl-page-header-content">
    <h1 id="mjl-page-title">${config.title}</h1><p class="mjl-page-header-description">Gestion des références métier MJL.</p></div><div class="mjl-page-header-actions">
    ${manage && !action ? `<a class="mjl-action mjl-action-primary" href="${route}${id ? '?id='+id+'&action=edit' : '?action=create'}">${id ? 'Modifier' : 'Créer un '+config.singular}</a>` : ''}</div></div></header>`;
   if (action) {
    const cancel = route + (id ? '?id='+id : '');
    const title = (action === 'create' ? 'Créer un ' : 'Modifier le ') + config.singular;
    app.insertAdjacentHTML('beforeend', `<dialog class="mjl-modal-dialog mjl-reference-dialog mjl-workflow-dialog" open aria-labelledby="reference-title" data-mjl-reference-page-dialog data-mjl-reference-cancel-href="${cancel}"><div class="mjl-dialog-panel">
     <header class="mjl-section-heading"><div><p class="mjl-eyebrow">Référence métier</p><h2 id="reference-title">${title}</h2><p>Les champs obligatoires sont indiqués.</p></div><a class="mjl-action mjl-action-secondary" data-mjl-reference-dialog-close href="${cancel}">Fermer</a></header>
     <form class="mjl-activity-form mjl-reference-form" data-mjl-substantive data-mjl-api-form>
     <div class="mjl-form-field"><label for="reference-label">Libellé <span aria-hidden="true">*</span></label><input id="reference-label" name="label" required maxlength="255" value="${escape(row?.label || '')}"></div>
     ${parentField}<div class="mjl-activity-form-actions"><button class="button" type="submit">Enregistrer</button><a class="mjl-action mjl-action-secondary" href="${cancel}">Annuler</a></div></form></div></dialog>`);
    bind(app.querySelector('form'), (action === 'create' ? 'create' : 'rename') + config.operation, action === 'create' ? 'POST' : 'PATCH', () => ({
     label: app.querySelector('[name=label]').value,
     ...(row ? {fingerprint: row.fingerprint} : {}),
     ...(project && action === 'create' ? {partner_id: app.querySelector('[name=partner_id]').value} : {})
    }));
   } else if (row) {
    app.insertAdjacentHTML('beforeend', `<section class="mjl-workspace-section mjl-reference-detail"><h2>${escape(row.label)}</h2><dl class="mjl-activity-meta">
     <div><dt>Libellé</dt><dd>${escape(row.label)}</dd></div>${project ? `<div><dt>Partenaire</dt><dd>${escape(row.partner_label)}</dd></div>` : ''}
     <div><dt>Statut</dt><dd>${badge(row)}</dd></div></dl><a class="mjl-action mjl-action-secondary" href="${route}">Tous les ${config.title}</a></section>`);
    if (manage) {
     const verb = row.active ? 'Désactiver' : 'Activer';
     const guidance = row.active
      ? (config.operation === 'Partner' ? 'Les Projets actifs liés seront également désactivés. Cette action ne supprime aucun historique.' : 'Cette référence ne sera plus disponible pour les nouveaux travaux. Les historiques sont conservés.')
      : (project ? 'Le Partenaire du Projet doit être actif.' : 'Cette référence redevient disponible pour les nouveaux travaux autorisés.');
     app.querySelector('section').insertAdjacentHTML('beforeend', `<div id="reference-lifecycle" data-mjl-reference-lifecycle-source>
      <button class="mjl-action ${row.active ? 'mjl-action-danger' : 'mjl-action-secondary'}" type="button" data-mjl-reference-lifecycle-open data-reference-source="reference-lifecycle" data-reference-title="${verb} le ${config.singular}" data-reference-context="${escape(row.label)}" data-reference-guidance="${guidance}" data-reference-confirm-label="${row.active ? 'Confirmer la désactivation' : 'Confirmer l’activation'}">${verb}</button>
      <form class="mjl-reference-lifecycle-form"><button class="button" type="submit">${verb}</button></form></div>
      <dialog class="mjl-modal-dialog mjl-reference-dialog mjl-workflow-dialog" aria-labelledby="lifecycle-title" data-mjl-reference-lifecycle-dialog><div class="mjl-dialog-panel"><header class="mjl-section-heading"><div><h2 id="lifecycle-title" data-reference-dialog-title></h2><p data-reference-dialog-context></p></div><button type="button" class="mjl-action mjl-action-secondary" data-mjl-reference-lifecycle-close>Fermer</button></header><div class="mjl-system-state mjl-system-state-warning" data-reference-dialog-guidance></div><div data-reference-dialog-form></div></div></dialog>`);
     bind(app.querySelector('form'), 'set'+config.operation+'Active', 'PUT', () => ({active: !row.active, fingerprint: row.fingerprint}));
    }
   } else {
    const page = /^[1-9][0-9]*$/.test(query.get('page') || '') ? Number(query.get('page')) : 1;
    const parentFilter = project && query.has('partner_id') ? '&partner_id='+encodeURIComponent(query.get('partner_id')) : '';
    const result = await mjlApi.request(endpoint+'?page='+page+parentFilter);
    let html = `<section class="mjl-workspace-section mjl-reference-list" data-mjl-reference-list="${app.dataset.kind}">`;
    if (!result.data.length) html += '<h2>Aucune référence</h2><p>Aucun élément n’est encore enregistré.</p>';
    else html += `<div class="div-table-responsive-no-min mjl-operational-table"><table class="noborder centpercent mjl-reference-table" aria-label="${config.title}"><thead><tr class="liste_titre"><th>${config.singular}</th>${project ? '<th>Partenaire</th>' : ''}<th>Statut</th>${manage ? '<th>Actions</th>' : ''}</tr></thead><tbody>
     ${result.data.map(p => `<tr class="oddeven mjl-row-interactive" data-reference-row><td data-label="${config.singular}"><a class="mjl-table-link" href="${route}?id=${p.id}">${escape(p.label)}</a></td>
      ${project ? `<td data-label="Partenaire">${escape(p.partner_label)}</td>` : ''}<td data-label="Statut">${badge(p)}</td>
      ${manage ? `<td class="right" data-label="Actions"><details class="mjl-table-action-menu" data-mjl-action-menu><summary aria-label="Actions pour ${escape(p.label)}">Actions</summary><div class="mjl-table-action-menu-panel"><a class="mjl-table-action-menu-item" href="${route}?id=${p.id}">Consulter</a><a class="mjl-table-action-menu-item" href="${route}?id=${p.id}&action=edit">Modifier</a></div></details></td>` : ''}</tr>`).join('')}
     </tbody></table></div>`;
    html += `<nav aria-label="Pages — ${config.title}">${page > 1 ? `<a href="${route}?page=${page-1}${parentFilter}">Précédent</a> ` : ''}${result.pagination.has_next ? `<a href="${route}?page=${page+1}${parentFilter}">Suivant</a>` : ''}</nav></section>`;
    app.insertAdjacentHTML('beforeend', html);
   }
   window.mjlInitReferenceComponents(app);
   function bind(form, operation, method, body) {
    let busy = false, blocked = false;
    form.addEventListener('submit', async event => {
     event.preventDefault();
     if (busy || blocked || !form.reportValidity()) return;
     busy = true; form.setAttribute('aria-busy', 'true');
     const button = form.querySelector('button[type=submit]'); button.disabled = true;
     try {
      const token = await mjlApi.request('/submission-tokens', 'POST', {operation_id:operation, path_parameters:id ? {id} : {}});
      const result = await mjlApi.request(endpoint+(id ? '/'+id : '')+(method === 'PUT' ? '/activation' : ''), method, body(), token.data.token);
      form.dispatchEvent(new Event('mjl:api-saved'));
      location.assign(route+'?id='+result.data.id);
     } catch (e) {
      blocked = ['outcome_unknown','stale_fingerprint','submission_invalid'].includes(e.code);
      error(e.message, form); busy = false; button.disabled = blocked; form.removeAttribute('aria-busy');
     }
    });
   }
  } catch (e) { app.querySelector('[data-loading]')?.remove(); error(e.message); }
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());

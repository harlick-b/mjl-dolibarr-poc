(function () {
  'use strict';
  var list = document.querySelector('[data-operation-list]');
  if (!list) return;
  var form = list.closest('form');
  var template = list.querySelector('[data-operation-row]').cloneNode(true);
  var amount = form.querySelector('[name="authorized_amount"]');
  var start = form.querySelector('[name="date_start"]');
  var end = form.querySelector('[name="date_end"]');
  var guidance = form.querySelector('[data-budget-guidance]');
  var add = form.querySelector('[data-add-operation]');
  var partner = form.querySelector('[name="partner_id"]');
  var project = form.querySelector('[name="project_id"]');
  var nextOperationKey = 0;

  var projectOptions = Array.prototype.slice.call(project.options);
  function syncProjects() {
    var selected = project.value;
    while (project.options.length) project.remove(0);
    projectOptions.forEach(function (option) {
      if (!option.value || (partner.value && option.dataset.partnerId === partner.value)) project.add(option);
    });
    project.value = selected && projectOptions.some(function (option) {
      return option.value === selected && option.dataset.partnerId === partner.value;
    }) ? selected : '';
    project.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (window.jQuery) window.jQuery(partner).on('change', syncProjects);
  else partner.addEventListener('change', syncProjects);
  syncProjects();

  function refresh() {
    var rows = Array.prototype.slice.call(list.querySelectorAll('[data-operation-row]'));
    rows.forEach(function (row, index) {
      row.querySelector('[data-operation-number]').textContent = 'Opération ' + (index + 1);
    });
    var result = window.MjlFinance.summary(amount.value, rows.map(function (row) {
      return row.querySelector('[name="operation_amount[]"]').value;
    }));
    form.querySelector('[data-activity-total]').textContent = result.activity;
    form.querySelector('[data-operation-total]').textContent = result.operations;
    form.querySelector('[data-difference]').textContent = result.difference;
    add.disabled = rows.length >= 50;
    if (result.activity === 'Saisie invalide' || result.operations === 'Saisie invalide') {
      guidance.textContent = 'Vérifiez les montants entiers saisis.';
    } else if (result.difference === 'Non renseigné') {
      guidance.textContent = 'Complétez les montants pour vérifier leur équilibre.';
    } else if (result.difference !== '-') {
      guidance.textContent = 'Avant la soumission, le montant de l’Activité doit être égal au total des Opérations.';
    } else if (start.value && end.value && start.value > end.value) {
      guidance.textContent = 'La date de fin doit suivre ou égaler la date de début.';
    } else {
      guidance.textContent = 'Les montants sont équilibrés. Vérifiez les autres champs avant l’enregistrement.';
    }
    return result;
  }

  list.addEventListener('click', function (event) {
    var button = event.target.closest('[data-remove-operation]');
    if (!button || !list.contains(button)) return;
    var row = button.closest('[data-operation-row]');
    if (list.querySelectorAll('[data-operation-row]').length === 1) {
      row.querySelector('[name="operation_name[]"]').focus();
      return;
    }
    var next = row.nextElementSibling || row.previousElementSibling;
    if (window.MjlUi) window.MjlUi.destroy(row);
    row.remove();
    if (next) next.querySelector('input:not([type="hidden"]), select').focus();
    refresh();
  });
  list.addEventListener('input', refresh);
  list.addEventListener('change', refresh);
  amount.addEventListener('input', refresh);
  start.addEventListener('change', refresh);
  end.addEventListener('change', refresh);
  add.addEventListener('click', function () {
    if (list.querySelectorAll('[data-operation-row]').length >= 50) return;
    var row = template.cloneNode(true);
    row.querySelectorAll('input').forEach(function (input) { if (input.type !== 'hidden') input.value = ''; });
    row.querySelector('[name="operation_key[]"]').value = 'op-new-' + (++nextOperationKey);
    row.querySelector('[name="operation_id[]"]').value = '';
    row.querySelector('[name="operation_version[]"]').value = '';
    row.querySelector('select').selectedIndex = 0;
    list.appendChild(row);
    if (window.MjlUi) window.MjlUi.init(row);
    row.querySelector('[name="operation_name[]"]').focus();
    refresh();
  });
  var dateRangeField = null;
  form.addEventListener('input', function () {
    if (dateRangeField) { dateRangeField.setCustomValidity(''); dateRangeField = null; }
  }, true);
  form.addEventListener('submit', function (event) {
    var result = refresh();
    if (!form.reportValidity()) {
      event.preventDefault();
      return;
    }
    if (start.value && end.value && start.value > end.value) {
      event.preventDefault();
      guidance.textContent = 'La date de fin doit suivre ou égaler la date de début.';
      dateRangeField = document.getElementById('activity-end');
      dateRangeField.setCustomValidity(guidance.textContent);
      dateRangeField.reportValidity();
      return;
    }
    if (event.submitter && event.submitter.value === 'create_submit' && result.difference !== '-') {
      event.preventDefault();
      amount.focus();
      guidance.textContent = 'Avant la soumission, le montant de l’Activité doit être égal au total des Opérations.';
    }
  });
  refresh();
})();

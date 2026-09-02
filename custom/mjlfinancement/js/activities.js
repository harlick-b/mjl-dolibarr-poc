(function () {
  'use strict';
  const list = document.querySelector('[data-operation-list]');
  if (!list) return;
  const format = (value) => value.toLocaleString('fr-FR') + ' F CFA';
  const refresh = () => {
    const activity = Number((document.querySelector('[name="authorized_amount"]') || {}).value || 0);
    let operations = 0;
    list.querySelectorAll('[name="operation_amount[]"]').forEach((input) => { operations += Number(input.value || 0); });
    const activityNode = document.querySelector('[data-activity-total]');
    const operationNode = document.querySelector('[data-operation-total]');
    const differenceNode = document.querySelector('[data-difference]');
    if (activityNode) activityNode.textContent = format(activity);
    if (operationNode) operationNode.textContent = format(operations);
    if (differenceNode) differenceNode.textContent = format(activity - operations);
  };
  const bind = (row) => {
    const remove = row.querySelector('[data-remove-operation]');
    if (remove) remove.addEventListener('click', () => {
      const rows = list.querySelectorAll('[data-operation-row]');
      if (rows.length === 1) rows[0].querySelector('[name="operation_name[]"]').focus();
      else { const next = row.nextElementSibling || row.previousElementSibling; row.remove(); if (next) next.querySelector('input,select').focus(); refresh(); }
    });
    row.querySelectorAll('input').forEach((input) => input.addEventListener('input', refresh));
  };
  list.querySelectorAll('[data-operation-row]').forEach(bind);
  const add = document.querySelector('[data-add-operation]');
  if (add) add.addEventListener('click', () => {
    if (list.querySelectorAll('[data-operation-row]').length >= 50) return;
    const template = list.querySelector('[data-operation-row]');
    const row = template.cloneNode(true);
    row.querySelectorAll('input').forEach((input) => { input.value = ''; });
    row.querySelector('[name="operation_key[]"]').value = 'op-' + Date.now() + '-' + list.children.length;
    row.querySelector('select').selectedIndex = 0;
    list.appendChild(row); bind(row); row.querySelector('[name="operation_name[]"]').focus(); refresh();
  });
  refresh();
})();

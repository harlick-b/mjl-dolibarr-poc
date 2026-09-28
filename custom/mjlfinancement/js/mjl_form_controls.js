(function (root) {
  'use strict';
  function elements(scope, selector) {
    var result = [];
    if (scope.matches && scope.matches(selector)) result.push(scope);
    return result.concat(Array.prototype.slice.call(scope.querySelectorAll(selector)));
  }
  function dateFromIso(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    var parts = value.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
  }
  function isoFromDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function frenchFromIso(value) {
    var date = dateFromIso(value);
    return date ? String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0') + '/' + date.getFullYear() : '';
  }
  function isoFromFrench(value) {
    var match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    var iso = match[3] + '-' + match[2] + '-' + match[1];
    return dateFromIso(iso) ? iso : null;
  }
  function initDate(input) {
    if (input.dataset.mjlEnhanced || !root.jQuery || !root.jQuery.fn.datepicker) return;
    var originalId = input.id;
    var display = document.createElement('input');
    display.type = 'text';
    display.id = originalId;
    display.value = frenchFromIso(input.value);
    display.placeholder = 'jj/mm/aaaa';
    display.setAttribute('inputmode', 'numeric');
    display.setAttribute('autocomplete', 'off');
    display.required = input.required;
    var wrapper = document.createElement('span');
    wrapper.className = 'mjl-date-control';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-secondary mjl-date-trigger';
    button.textContent = 'Calendrier';
    button.setAttribute('aria-label', 'Choisir une date dans le calendrier');
    button.setAttribute('aria-expanded', 'false');
    var calendar = document.createElement('span');
    calendar.className = 'mjl-date-calendar';
    calendar.hidden = true;
    input.parentNode.insertBefore(wrapper, input);
    input.id = originalId + '-iso';
    input.type = 'hidden';
    input.required = false;
    wrapper.appendChild(input);
    wrapper.appendChild(display);
    wrapper.appendChild(button);
    wrapper.appendChild(calendar);
    root.jQuery(calendar).datepicker({
      firstDay: 1,
      monthNames: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
      dayNames: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
      dayNamesMin: ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'],
      prevText: 'Mois précédent', nextText: 'Mois suivant',
      onSelect: function () {
        var selected = isoFromDate(root.jQuery(calendar).datepicker('getDate'));
        input.value = selected;
        display.value = frenchFromIso(selected);
        display.setCustomValidity('');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close(true);
      }
    });
    function close(restoreFocus) {
      calendar.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (restoreFocus) button.focus();
    }
    function sync() {
      var value = display.value.trim();
      var iso = isoFromFrench(value);
      input.value = iso || '';
      display.setCustomValidity(value && !iso ? 'Saisissez une date valide au format jj/mm/aaaa.' : '');
      if (iso) root.jQuery(calendar).datepicker('setDate', dateFromIso(iso));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    display.addEventListener('input', sync);
    display.addEventListener('change', function () { sync(); input.dispatchEvent(new Event('change', { bubbles: true })); });
    button.addEventListener('click', function () {
      if (!calendar.hidden) { close(true); return; }
      if (input.value) root.jQuery(calendar).datepicker('setDate', dateFromIso(input.value));
      calendar.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      var selected = calendar.querySelector('.ui-datepicker-current-day a') || calendar.querySelector('.ui-datepicker-today a') || calendar.querySelector('a');
      if (selected) selected.focus();
    });
    wrapper.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !calendar.hidden) { event.preventDefault(); close(true); }
    });
    input.dataset.mjlEnhanced = 'date';
  }
  function initSelect(select) {
    if (select.dataset.mjlEnhanced || !root.jQuery || !root.jQuery.fn.select2) return;
    var dialog = select.closest('dialog');
    root.jQuery(select).select2({ width: '100%', dropdownParent: root.jQuery(dialog || document.body), language: { noResults: function () { return 'Aucun résultat'; }, searching: function () { return 'Recherche…'; } } });
    select.dataset.mjlEnhanced = 'select';
  }
  function init(scope) {
    elements(scope || document, '[data-mjl-date]').forEach(initDate);
    elements(scope || document, '[data-mjl-select]').forEach(initSelect);
  }
  function destroy(scope) {
    elements(scope, '[data-mjl-select][data-mjl-enhanced="select"]').forEach(function (select) {
      root.jQuery(select).select2('destroy');
      delete select.dataset.mjlEnhanced;
    });
    elements(scope, '[data-mjl-date][data-mjl-enhanced="date"]').forEach(function (input) {
      var wrapper = input.closest('.mjl-date-control');
      root.jQuery(wrapper.querySelector('.mjl-date-calendar')).datepicker('destroy');
      var originalId = input.id.slice(0, -4);
      input.type = 'date';
      input.id = originalId;
      input.required = wrapper.querySelector('input[type="text"]').required;
      wrapper.parentNode.insertBefore(input, wrapper);
      wrapper.remove();
      delete input.dataset.mjlEnhanced;
    });
  }
  root.MjlUi = { init: init, destroy: destroy };
  document.addEventListener('DOMContentLoaded', function () { init(document); });
})(window);

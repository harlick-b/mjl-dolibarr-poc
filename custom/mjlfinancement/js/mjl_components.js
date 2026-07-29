(function () {
	'use strict';

	function fieldMessage(field) {
		if (field.validity.valueMissing) {
			return field.getAttribute('data-mjl-required-message') || 'Ce champ est obligatoire.';
		}
		if (field.validity.rangeUnderflow || field.validity.rangeOverflow) {
			return 'La valeur saisie est hors des limites autorisées.';
		}
		if (field.validity.typeMismatch || field.validity.badInput) {
			return 'La valeur saisie n’est pas valide.';
		}
		return field.validationMessage || 'Vérifiez ce champ.';
	}

	function clearErrors(form) {
		var host = form.querySelector('[data-mjl-form-errors]');
		if (host) host.innerHTML = '';
		Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid="true"]'), function (field) {
			field.removeAttribute('aria-invalid');
			var describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) {
				return id && !/-error$/.test(id);
			});
			if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
			else field.removeAttribute('aria-describedby');
		});
		Array.prototype.forEach.call(form.querySelectorAll('.mjl-field-error-message[data-mjl-client-error]'), function (error) {
			error.remove();
		});
	}

	function validateForm(form) {
		clearErrors(form);
		var invalid = [];
		Array.prototype.forEach.call(form.querySelectorAll('input, select, textarea'), function (field) {
			if (field.disabled || field.type === 'hidden' || field.validity.valid) return;
			var id = field.id || ('mjl-field-' + field.name.replace(/[^a-z0-9_-]/gi, ''));
			field.id = id;
			var errorId = id + '-error';
			var message = fieldMessage(field);
			field.setAttribute('aria-invalid', 'true');
			var describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
			if (describedBy.indexOf(errorId) === -1) describedBy.push(errorId);
			field.setAttribute('aria-describedby', describedBy.join(' '));
			var error = document.createElement('p');
			error.id = errorId;
			error.className = 'mjl-field-error-message';
			error.setAttribute('data-mjl-client-error', '');
			error.textContent = message;
			field.insertAdjacentElement('afterend', error);
			invalid.push({ field: field, message: message });
		});
		if (!invalid.length) return true;
		var summary = document.createElement('div');
		summary.className = 'mjl-form-error-summary';
		summary.setAttribute('role', 'alert');
		summary.setAttribute('tabindex', '-1');
		summary.setAttribute('data-mjl-error-summary', '');
		var title = document.createElement('strong');
		title.textContent = 'Corrigez les champs indiqués';
		summary.appendChild(title);
		var list = document.createElement('ul');
		invalid.forEach(function (entry) {
			var item = document.createElement('li');
			var link = document.createElement('a');
			link.href = '#' + entry.field.id;
			link.textContent = entry.message;
			item.appendChild(link);
			list.appendChild(item);
		});
		summary.appendChild(list);
		var host = form.querySelector('[data-mjl-form-errors]');
		if (host) host.appendChild(summary);
		else form.insertBefore(summary, form.firstChild);
		summary.focus();
		return false;
	}

	function initValidatedForm(form) {
		form.addEventListener('submit', function (event) {
			if (!validateForm(form)) event.preventDefault();
		});
		form.setAttribute('novalidate', '');
	}

	function formatDecisionValue(field) {
		if (!field || !field.value) return 'Non renseigné';
		if (field.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(field.value)) {
			return field.value.slice(8, 10) + '/' + field.value.slice(5, 7) + '/' + field.value.slice(0, 4);
		}
		return field.value;
	}

	function decisionSummary(form) {
		var values = [];
		var amount = form.querySelector('[name="final_validated_amount"], [name="prevalidated_amount"]');
		var beneficiary = form.querySelector('[name="beneficiary_name"]');
		var date = form.querySelector('[name="disbursement_date"]');
		values.push('Objet : ' + (form.getAttribute('data-mjl-object') || 'Dépense'));
		values.push('Décision : ' + (form.getAttribute('data-mjl-transition') || 'Décision'));
		if (amount) values.push('Montant : ' + formatDecisionValue(amount));
		if (beneficiary) values.push('Bénéficiaire : ' + formatDecisionValue(beneficiary));
		if (date) values.push('Date : ' + formatDecisionValue(date));
		return values;
	}

	function createDecisionDialog() {
		var dialog = document.createElement('dialog');
		dialog.className = 'mjl-confirmation-dialog';
		dialog.setAttribute('aria-labelledby', 'mjl-confirmation-title');
		dialog.innerHTML = '<div class="mjl-confirmation-panel"><h2 id="mjl-confirmation-title">Confirmer la décision</h2><p data-mjl-confirmation-consequence></p><ul data-mjl-confirmation-summary></ul><div class="mjl-confirmation-actions"><button type="button" class="mjl-action mjl-action-secondary" data-mjl-confirm-cancel>Annuler</button><button type="button" class="mjl-action mjl-action-danger" data-mjl-confirm-submit>Confirmer</button></div></div>';
		document.body.appendChild(dialog);
		return dialog;
	}

	function initDecisionForm(form, dialog) {
		var trigger = form.querySelector('[type="submit"]');
		var confirmed = false;
		var restoreTarget = null;
		form.addEventListener('submit', function (event) {
			if (event.defaultPrevented || confirmed) return;
			event.preventDefault();
			restoreTarget = document.activeElement === trigger ? trigger : trigger;
			dialog.querySelector('[data-mjl-confirmation-consequence]').textContent = form.querySelector('[data-mjl-consequence] p').textContent;
			var summary = dialog.querySelector('[data-mjl-confirmation-summary]');
			summary.innerHTML = '';
			decisionSummary(form).forEach(function (line) {
				var item = document.createElement('li');
				item.textContent = line;
				summary.appendChild(item);
			});
			dialog._mjlForm = form;
			dialog._mjlConfirm = function () {
				if (confirmed) return;
				confirmed = true;
				Array.prototype.forEach.call(form.querySelectorAll('button[type="submit"], input[type="submit"]'), function (button) {
					button.disabled = true;
					button.setAttribute('aria-busy', 'true');
				});
				dialog.close();
				form.submit();
			};
			dialog.showModal();
			dialog.querySelector('[data-mjl-confirm-cancel]').focus();
		});
		dialog.addEventListener('close', function () {
			if (restoreTarget && document.contains(restoreTarget)) restoreTarget.focus();
			restoreTarget = null;
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		Array.prototype.forEach.call(document.querySelectorAll('form[data-mjl-validate]'), initValidatedForm);
		var decisionForms = document.querySelectorAll('form[data-mjl-confirm]');
		if (decisionForms.length) {
			var dialog = createDecisionDialog();
			dialog.querySelector('[data-mjl-confirm-cancel]').addEventListener('click', function () {
				dialog.close();
			});
			dialog.querySelector('[data-mjl-confirm-submit]').addEventListener('click', function () {
				if (dialog._mjlConfirm) dialog._mjlConfirm();
			});
			dialog.addEventListener('keydown', function (event) {
				if (event.key !== 'Tab') return;
				var focusable = dialog.querySelectorAll('button:not([disabled])');
				if (!focusable.length) return;
				var first = focusable[0];
				var last = focusable[focusable.length - 1];
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			});
			Array.prototype.forEach.call(decisionForms, function (form) {
				initDecisionForm(form, dialog);
			});
		}
	});
})();

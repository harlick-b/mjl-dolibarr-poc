(function () {
	'use strict';
	function init() {

	document.querySelectorAll('[data-mjl-password-toggle]').forEach(function (button) {
		button.addEventListener('click', function () {
			var input = button.parentElement.querySelector('input');
			var visible = input.type === 'password';
			input.type = visible ? 'text' : 'password';
			button.setAttribute('aria-pressed', visible ? 'true' : 'false');
			button.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
		});
	});

	var otp = document.querySelector('[data-mjl-otp]');
	if (otp) {
		var input = otp.querySelector('input');
		var slots = Array.prototype.slice.call(otp.querySelectorAll('.mjl-otp-slots span'));
		var sync = function () {
			input.value = input.value.replace(/\D/g, '').slice(0, 6);
			slots.forEach(function (slot, index) { slot.textContent = input.value.charAt(index); });
		};
		input.addEventListener('input', sync);
		input.addEventListener('paste', function (event) {
			event.preventDefault();
			input.value = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
			sync();
		});
		sync();
	}

	var password = document.querySelector('[data-mjl-new-password]');
	var confirmation = document.querySelector('[data-mjl-confirm-password]');
	var rules = document.querySelectorAll('[data-mjl-password-rule]');
	var submit = document.querySelector('[data-mjl-password-submit]');
	if (password && confirmation && submit) {
		var validate = function () {
			var value = password.value;
			var states = [Array.from(value).length >= 8, /\p{Lu}/u.test(value), /\p{Ll}/u.test(value), /\p{N}/u.test(value), /[^\p{L}\p{N}\s]/u.test(value)];
			rules.forEach(function (rule, index) {
				rule.dataset.valid = states[index] ? 'true' : 'false';
				rule.textContent = (states[index] ? '✓ ' : '') + rule.dataset.label;
			});
			var mismatch = confirmation.value !== '' && confirmation.value !== value;
			confirmation.setAttribute('aria-invalid', mismatch ? 'true' : 'false');
			var error = document.querySelector('[data-mjl-password-mismatch]');
			if (error) error.textContent = mismatch ? 'Les mots de passe ne correspondent pas.' : '';
			submit.disabled = !states.every(Boolean) || confirmation.value === '' || mismatch;
		};
		password.addEventListener('input', validate);
		confirmation.addEventListener('input', validate);
		validate();
	}

	document.querySelectorAll('[data-mjl-auth-form]').forEach(function (form) {
		form.addEventListener('submit', function () {
			var button = form.querySelector('button[type=submit]');
			if (!button || button.disabled) return;
			button.disabled = true;
			button.setAttribute('aria-busy', 'true');
		});
	});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
}());

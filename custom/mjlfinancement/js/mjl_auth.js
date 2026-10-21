(function () {
	'use strict';
	function init() {
	document.querySelectorAll('[data-mjl-js-required]').forEach(function (message) { message.remove(); });

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

	document.querySelectorAll('[data-mjl-auth-form]:not([data-mjl-auth-api])').forEach(function (form) {
		form.addEventListener('submit', function () {
			var button = form.querySelector('button[type=submit]');
			if (!button || button.disabled) return;
			button.disabled = true;
			button.setAttribute('aria-busy', 'true');
		});
	});
 document.querySelectorAll('[data-mjl-auth-api]').forEach(function (form) {
  const mode = form.dataset.mjlAuthApi;
  const base = new URL('../', document.querySelector('script[src*="/js/mjl_api.js"]').src).pathname.replace(/\/$/, '');
  const appRoot = base.replace(/\/custom\/mjlfinancement$/, '');
  let busy = false, usable = !['invitation','reset-consume'].includes(mode);
  function message(text, success) {
   let box = form.parentElement.querySelector('[data-auth-api-message]');
   if (!box) { box=document.createElement('div'); box.dataset.authApiMessage=''; box.tabIndex=-1; form.before(box); }
   box.className='mjl-auth-message '+(success?'mjl-auth-success':'mjl-auth-error'); box.setAttribute('role',success?'status':'alert'); box.textContent=text; box.focus();
  }
  function proof() { return {selector: form.elements.selector?.value || form.elements.mjlselector?.value || '', verifier:form.elements.verifier.value}; }
  if (!usable) {
   // auth_fragment.js consumes the URL fragment before DOMContentLoaded.
   form.hidden = true;
   mjlApi.request('/auth/'+(mode==='invitation'?'invitations':'password-resets')+'/inspect','POST',proof()).then(result => {
    usable = result.data.valid;
    if (!usable) { message('Ce lien est invalide ou a expiré.'); return; }
    form.querySelector('.mjl-auth-readonly span').textContent=result.data.email;
    form.hidden=false;
   }).catch(e => message(e.message));
  }
  form.addEventListener('submit',async function(event) {
   event.preventDefault(); if (busy || !usable || !form.reportValidity()) return;
   busy=true;
   const button=form.querySelector('button[type=submit]'); button.disabled=true; button.setAttribute('aria-busy','true');
   try {
    let result;
    if(mode==='login') {
     result=await mjlApi.request('/auth/login','POST',{email:form.elements.email.value,password:form.elements.password.value});
     location.assign(base+'/auth.php');
    } else if(mode==='verify') {
     result=await mjlApi.request('/auth/otp/verify','POST',{code:form.elements.code.value});
     location.assign(base+'/index.php');
    } else if(mode==='resend') {
     await mjlApi.request('/auth/otp/resend','POST',{}); message('Un nouveau code a été envoyé.',true);
    } else if(mode==='cancel') {
     await mjlApi.request('/auth/session','DELETE'); location.assign(appRoot+'/index.php');
    } else if(mode==='reset-request') {
     result=await mjlApi.request('/auth/password-resets','POST',{email:form.elements.email.value});
     location.assign(appRoot+'/user/passwordforgotten.php?mjl_reset_requested=1');
    } else {
     result=await mjlApi.request('/auth/'+(mode==='invitation'?'invitations/accept':'password-resets/consume'),'POST',{...proof(),password:form.elements.newpass1.value,password_confirmation:form.elements.newpass2.value});
     form.reset(); usable=false; location.assign(appRoot+'/index.php');
    }
   } catch(e) { message(e.message); }
   finally { busy=false; button.disabled=false; button.removeAttribute('aria-busy'); if (typeof validate === 'function') validate(); }
  });
 });

	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
}());

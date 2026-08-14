(function () {
	'use strict';
	var field = document.getElementById('verifier');
	if (!field) return;
	var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
	var verifier = params.get('verifier');
	if (verifier) field.value = verifier;
	if (window.location.hash) window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
}());

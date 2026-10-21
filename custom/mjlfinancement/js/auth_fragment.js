(function () {
	'use strict';
	var field = document.getElementById('verifier');
	if (!field) return;
	var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
	var verifier = params.get('verifier');
	if (verifier) field.value = verifier;
	// Following another email link to the same page may only change its fragment.
	window.addEventListener('hashchange', function () {
		if (new URLSearchParams(window.location.hash.slice(1)).has('verifier')) window.location.reload();
	});
	if (window.location.hash) window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
}());

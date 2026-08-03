(function () {
	'use strict';

	function initNavigationDrawer(shell) {
		var trigger = shell.querySelector('.mjl-navigation-trigger');
		var sidebar = shell.querySelector('#mjl-primary-navigation');
		var backdrop = shell.querySelector('[data-mjl-navigation-backdrop]');
		var closeButton = shell.querySelector('[data-mjl-navigation-close]');
		var main = shell.querySelector('#mjl-main-content');
		if (!trigger || !sidebar || !backdrop || !closeButton || !main) return;

		var media = window.matchMedia('(max-width: 980px)');
		var isOpen = false;
		var lastFocusWasInSidebar = false;
		var ownedInert = [];
		var backgroundObserver = null;
		shell.classList.add('mjl-navigation-enhanced');
		document.addEventListener('focusin', function (event) {
			if (isOpen && !sidebar.contains(event.target)) {
				focusDrawer();
				return;
			}
			lastFocusWasInSidebar = sidebar.contains(event.target);
		});

		function focusableElements() {
			return Array.prototype.filter.call(
				sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
				function (element) {
					return element.offsetParent !== null;
				}
			);
		}

		function focusDrawer() {
			var firstLink = sidebar.querySelector('a[href]');
			if (firstLink) firstLink.focus();
			else closeButton.focus();
		}

		function ownInert(element) {
			if (element.hasAttribute('inert')) return;
			ownedInert.push({
				element: element,
				hadMarker: element.hasAttribute('data-mjl-navigation-inert'),
				markerValue: element.getAttribute('data-mjl-navigation-inert'),
			});
			element.setAttribute('inert', '');
			element.setAttribute('data-mjl-navigation-inert', '');
		}

		function isolateOutsideBranches(root) {
			Array.prototype.forEach.call(root.children || [], function (child) {
				if (child === sidebar || child === backdrop) return;
				if (child.contains(sidebar) || child.contains(backdrop)) {
					isolateOutsideBranches(child);
					return;
				}
				ownInert(child);
			});
		}

		function isolateBackground() {
			isolateOutsideBranches(document.body);
			backgroundObserver = new MutationObserver(function () {
				isolateOutsideBranches(document.body);
			});
			backgroundObserver.observe(document.body, { childList: true, subtree: true });
		}

		function restoreBackground() {
			if (backgroundObserver) {
				backgroundObserver.disconnect();
				backgroundObserver = null;
			}
			ownedInert.forEach(function (record) {
				record.element.removeAttribute('inert');
				if (record.hadMarker) record.element.setAttribute('data-mjl-navigation-inert', record.markerValue || '');
				else record.element.removeAttribute('data-mjl-navigation-inert');
			});
			ownedInert = [];
		}

		function closeDrawer(restoreFocus) {
			isOpen = false;
			shell.classList.remove('mjl-navigation-is-open');
			document.body.classList.remove('mjl-navigation-open');
			trigger.setAttribute('aria-expanded', 'false');
			restoreBackground();
			if (media.matches) sidebar.setAttribute('aria-hidden', 'true');
			else sidebar.removeAttribute('aria-hidden');
			if (restoreFocus && document.contains(trigger)) trigger.focus();
		}

		function openDrawer() {
			if (!media.matches || isOpen) return;
			isOpen = true;
			shell.classList.add('mjl-navigation-is-open');
			document.body.classList.add('mjl-navigation-open');
			trigger.setAttribute('aria-expanded', 'true');
			sidebar.setAttribute('aria-hidden', 'false');
			isolateBackground();
			window.requestAnimationFrame(function () {
				if (!isOpen) return;
				focusDrawer();
			});
		}

		function syncViewport() {
			if (!media.matches) {
				closeDrawer(false);
				sidebar.removeAttribute('aria-hidden');
				return;
			}
			if (!isOpen) {
				if (lastFocusWasInSidebar) trigger.focus();
				sidebar.setAttribute('aria-hidden', 'true');
			}
		}

		trigger.addEventListener('click', openDrawer);
		closeButton.addEventListener('click', function () {
			closeDrawer(true);
		});
		backdrop.addEventListener('click', function () {
			closeDrawer(true);
		});
		sidebar.addEventListener('click', function (event) {
			var link = event.target.closest ? event.target.closest('a[href]') : null;
			if (isOpen && link && sidebar.contains(link)) closeDrawer(true);
		});
		sidebar.addEventListener('keydown', function (event) {
			if (event.key !== 'Tab' || !isOpen) return;
			var focusable = focusableElements();
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
		document.addEventListener('keydown', function (event) {
			if (event.key === 'Escape' && isOpen) closeDrawer(true);
		});
		if (media.addEventListener) media.addEventListener('change', syncViewport);
		else media.addListener(syncViewport);
		window.addEventListener('pagehide', function () {
			if (isOpen) closeDrawer(false);
		});
		syncViewport();
	}

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

	function substantiveFormSnapshot(form) {
		var values = [];
		Array.prototype.forEach.call(form.querySelectorAll('input, select, textarea'), function (field) {
			if (field.disabled || field.type === 'hidden' || field.type === 'submit' || field.type === 'button' || field.type === 'reset') return;
			var value = field.value;
			if (field.type === 'checkbox' || field.type === 'radio') value = field.checked ? '1:' + field.value : '0:' + field.value;
			if (field.multiple) {
				value = Array.prototype.filter.call(field.options, function (option) { return option.selected; }).map(function (option) { return option.value; }).join('\u001f');
			}
			values.push((field.name || field.id || '') + '\u001e' + value);
		});
		return values.join('\u001d');
	}

	function createUnsavedDialog() {
		var dialog = document.createElement('dialog');
		dialog.className = 'mjl-confirmation-dialog';
		dialog.setAttribute('aria-labelledby', 'mjl-unsaved-title');
		dialog.innerHTML = '<div class="mjl-confirmation-panel"><h2 id="mjl-unsaved-title">Modifications non enregistrées</h2><p>Vous avez des modifications non enregistrées. Voulez-vous quitter cette page ?</p><div class="mjl-confirmation-actions"><button type="button" class="mjl-action mjl-action-secondary" data-mjl-unsaved-stay>Continuer la saisie</button><button type="button" class="mjl-action mjl-action-danger" data-mjl-unsaved-leave>Quitter sans enregistrer</button></div></div>';
		document.body.appendChild(dialog);
		return dialog;
	}

	function trapDialogTab(dialog, event) {
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
	}

	function initSubstantiveForms(forms) {
		if (!forms.length) return;
		var dialog = createUnsavedDialog();
		var activeController = null;

		dialog.addEventListener('keydown', function (event) {
			trapDialogTab(dialog, event);
		});
		dialog.addEventListener('cancel', function (event) {
			event.preventDefault();
			dialog.close();
		});
		dialog.addEventListener('close', function () {
			if (activeController && activeController.restoreTarget && document.contains(activeController.restoreTarget)) {
				activeController.restoreTarget.focus();
			}
			if (activeController) activeController.restoreTarget = null;
		});
		dialog.querySelector('[data-mjl-unsaved-stay]').addEventListener('click', function () {
			dialog.close();
		});
		dialog.querySelector('[data-mjl-unsaved-leave]').addEventListener('click', function () {
			if (!activeController || !activeController.pendingHref) return;
			var href = activeController.pendingHref;
			activeController.acceptLeave();
			dialog.close();
			window.location.assign(href);
		});

		Array.prototype.forEach.call(forms, function (form) {
			var initialSnapshot = substantiveFormSnapshot(form);
			var recoveredDirty = form.getAttribute('data-mjl-recovered') === 'true';
			var dirty = false;
			var submitting = false;
			var beforeUnloadAttached = false;
			var controller = {
				pendingHref: '',
				restoreTarget: null,
				acceptLeave: function () {
					recoveredDirty = false;
					dirty = false;
					controller.pendingHref = '';
					detachBeforeUnload();
				},
			};

			function beforeUnload(event) {
				event.preventDefault();
				event.returnValue = '';
				return '';
			}

			function attachBeforeUnload() {
				if (beforeUnloadAttached) return;
				window.addEventListener('beforeunload', beforeUnload);
				beforeUnloadAttached = true;
			}

			function detachBeforeUnload() {
				if (!beforeUnloadAttached) return;
				window.removeEventListener('beforeunload', beforeUnload);
				beforeUnloadAttached = false;
			}

			function syncDirtyState() {
				dirty = recoveredDirty || substantiveFormSnapshot(form) !== initialSnapshot;
				if (dirty) attachBeforeUnload();
				else detachBeforeUnload();
			}

			function eligibleNavigation(event, link) {
				if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
				if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return false;
				var rawHref = link.getAttribute('href') || '';
				if (rawHref === '' || rawHref.charAt(0) === '#') return false;
				var target;
				try { target = new URL(link.href, window.location.href); } catch (error) { return false; }
				if (target.origin !== window.location.origin) return false;
				if (target.pathname === window.location.pathname && target.search === window.location.search && target.hash) return false;
				return true;
			}

			form.addEventListener('input', syncDirtyState);
			form.addEventListener('change', syncDirtyState);
			form.addEventListener('submit', function (event) {
				if (event.defaultPrevented) return;
				if (submitting) {
					event.preventDefault();
					event.stopImmediatePropagation();
					return;
				}
				submitting = true;
				controller.acceptLeave();
				form.setAttribute('aria-busy', 'true');
				Array.prototype.forEach.call(form.querySelectorAll('button[type="submit"], input[type="submit"]'), function (button) {
					button.disabled = true;
					button.setAttribute('aria-busy', 'true');
				});
			});
			document.addEventListener('click', function (event) {
				var link = event.target.closest ? event.target.closest('a[href]') : null;
				if (!dirty || submitting || !eligibleNavigation(event, link)) return;
				event.preventDefault();
				controller.pendingHref = link.href;
				controller.restoreTarget = link;
				activeController = controller;
				dialog.showModal();
				dialog.querySelector('[data-mjl-unsaved-stay]').focus();
			}, true);
			syncDirtyState();
		});
	}

	function initTableActionMenus(menus) {
		if (!menus.length) return;

		function items(menu) {
			return Array.prototype.filter.call(menu.querySelectorAll('[role="menuitem"]'), function (item) {
				return item.offsetParent !== null;
			});
		}

		function close(menu, restoreFocus) {
			var trigger = menu.querySelector('summary');
			menu.open = false;
			menu.classList.remove('mjl-table-action-menu-align-end', 'mjl-table-action-menu-open-up');
			if (trigger) trigger.setAttribute('aria-expanded', 'false');
			if (restoreFocus && trigger) trigger.focus();
		}

		function contain(menu) {
			var panel = menu.querySelector('.mjl-table-action-menu-panel');
			if (!panel) return;
			menu.classList.remove('mjl-table-action-menu-align-end', 'mjl-table-action-menu-open-up');
			var rect = panel.getBoundingClientRect();
			if (rect.right > window.innerWidth - 8) menu.classList.add('mjl-table-action-menu-align-end');
			if (rect.bottom > window.innerHeight - 8 && rect.height < window.innerHeight - 16) menu.classList.add('mjl-table-action-menu-open-up');
		}

		function open(menu, focusIndex) {
			Array.prototype.forEach.call(menus, function (other) {
				if (other !== menu && other.open) close(other, false);
			});
			menu.open = true;
			var trigger = menu.querySelector('summary');
			if (trigger) trigger.setAttribute('aria-expanded', 'true');
			window.requestAnimationFrame(function () {
				if (!menu.open) return;
				contain(menu);
				var links = items(menu);
				if (focusIndex !== null && links.length) links[focusIndex < 0 ? links.length - 1 : Math.min(focusIndex, links.length - 1)].focus();
			});
		}

		Array.prototype.forEach.call(menus, function (menu) {
			var trigger = menu.querySelector('summary');
			if (!trigger) return;
			trigger.setAttribute('aria-expanded', menu.open ? 'true' : 'false');
			menu.addEventListener('toggle', function () {
				trigger.setAttribute('aria-expanded', menu.open ? 'true' : 'false');
				if (menu.open) open(menu, null);
			});
			menu.addEventListener('keydown', function (event) {
				var links = items(menu);
				var index = links.indexOf(document.activeElement);
				if (document.activeElement === trigger && ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) !== -1) {
					event.preventDefault();
					open(menu, event.key === 'ArrowUp' || event.key === 'End' ? -1 : 0);
					return;
				}
				if (index !== -1 && ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) !== -1) {
					event.preventDefault();
					if (event.key === 'Home') index = 0;
					else if (event.key === 'End') index = links.length - 1;
					else index = (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
					links[index].focus();
				} else if (event.key === 'Escape' && menu.open) {
					event.preventDefault();
					close(menu, true);
				} else if (event.key === 'Tab' && menu.open) {
					close(menu, false);
				}
			});
		});

		document.addEventListener('click', function (event) {
			Array.prototype.forEach.call(menus, function (menu) {
				if (menu.open && !menu.contains(event.target)) close(menu, false);
			});
		});
		window.addEventListener('resize', function () {
			Array.prototype.forEach.call(menus, function (menu) { if (menu.open) contain(menu); });
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		Array.prototype.forEach.call(document.querySelectorAll('.mjl-module-shell'), initNavigationDrawer);
		Array.prototype.forEach.call(document.querySelectorAll('form[data-mjl-validate]'), initValidatedForm);
		initSubstantiveForms(document.querySelectorAll('form[data-mjl-substantive]'));
		initTableActionMenus(document.querySelectorAll('[data-mjl-action-menu]'));
	});
})();

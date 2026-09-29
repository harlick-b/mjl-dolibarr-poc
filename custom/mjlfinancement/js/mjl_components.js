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

			function promptToLeave(href, restoreTarget) {
				controller.pendingHref = href;
				controller.restoreTarget = restoreTarget;
				activeController = controller;
				dialog.showModal();
				dialog.querySelector('[data-mjl-unsaved-stay]').focus();
			}

			form.addEventListener('mjl:request-leave', function (event) {
				if (!event.detail || typeof event.detail.leave !== 'function') return;
				event.preventDefault();
				if (!dirty || submitting) {
					controller.acceptLeave();
					event.detail.leave();
					return;
				}
				promptToLeave(event.detail.href || '', event.detail.restoreTarget || null);
			});

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
					button.setAttribute('aria-busy', 'true');
				});
			});
			document.addEventListener('click', function (event) {
				var link = event.target.closest ? event.target.closest('a[href]') : null;
				if (!dirty || submitting || !eligibleNavigation(event, link)) return;
				event.preventDefault();
				promptToLeave(link.href, link);
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
			trigger.setAttribute('aria-haspopup', 'menu');
			var panel = menu.querySelector('.mjl-table-action-menu-panel');
			if (panel) panel.setAttribute('role', 'menu');
			Array.prototype.forEach.call(menu.querySelectorAll('.mjl-table-action-menu-item'), function (item) { item.setAttribute('role', 'menuitem'); });
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


	function initTabs(tablist) {
		var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[data-mjl-tab]'));
		if (!tabs.length) return;
		var panels = tabs.map(function (tab) { return document.getElementById(tab.getAttribute('href').slice(1)); });
		if (panels.some(function (panel) { return !panel; })) return;
		tablist.classList.add('mjl-tabs-enhanced');
		tablist.setAttribute('role', 'tablist');
		tabs.forEach(function (tab, index) {
			tab.setAttribute('role', 'tab');
			tab.setAttribute('aria-controls', panels[index].id);
			panels[index].setAttribute('role', 'tabpanel');
			panels[index].setAttribute('aria-labelledby', tab.id);
		});

		function select(tab, moveFocus) {
			tabs.forEach(function (item, index) {
				var selected = item === tab;
				item.setAttribute('aria-selected', selected ? 'true' : 'false');
				item.setAttribute('tabindex', selected ? '0' : '-1');
				panels[index].hidden = !selected;
			});
			if (moveFocus) tab.focus();
		}

		tabs.forEach(function (tab, index) {
			tab.addEventListener('click', function (event) {
				event.preventDefault();
				select(tab, false);
				window.history.replaceState(null, '', tab.getAttribute('href'));
			});
			tab.addEventListener('keydown', function (event) {
				if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) === -1) return;
				event.preventDefault();
				var target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
				select(tabs[target], true);
			});
		});
		var hashTab = tabs.find(function (tab) { return tab.getAttribute('href') === window.location.hash; });
		select(hashTab || tabs.find(function (tab) { return tab.getAttribute('data-mjl-selected') === 'true'; }) || tabs[0], false);
	}

	function initAssignmentDialog(dialog) {
		var operation = dialog.querySelector('[data-mjl-assignment-operation]');
		var target = dialog.querySelector('[data-mjl-assignment-target]');
		if (!operation || !target) return;
		var options = Array.prototype.map.call(target.options, function (option) { return option.cloneNode(true); });

		function syncTargets() {
			var action = operation.value;
			var selected = target.value;
			target.innerHTML = '';
			options.forEach(function (template, index) {
				var current = template.getAttribute('data-is-current') === '1';
				var primary = template.getAttribute('data-is-primary') === '1';
				var allowed = index === 0
					|| (action === 'ADD_ADDITIONAL' && !current)
					|| (action === 'REMOVE_ADDITIONAL' && current && !primary)
					|| (action === 'TRANSFER_PRIMARY' && !primary);
				if (!allowed) return;
				var option = template.cloneNode(true);
				if (option.value === selected) option.selected = true;
				target.appendChild(option);
			});
			if (!target.value) target.value = '';
		}
		operation.addEventListener('change', syncTargets);
		syncTargets();
	}

	function initNativeDialog(dialog, options) {
		if (typeof dialog.showModal !== 'function' || !options.triggers.length) return;
		var activeTrigger = null;
		Array.prototype.forEach.call(options.triggers, function (trigger) {
			trigger.addEventListener('click', function (event) {
				event.preventDefault();
				activeTrigger = trigger;
				if (options.beforeOpen) options.beforeOpen(trigger);
				dialog.showModal();
				var focusTarget = dialog.querySelector(options.focusTarget || 'select, input, textarea, button');
				if (focusTarget) focusTarget.focus();
			});
		});
		Array.prototype.forEach.call(dialog.querySelectorAll(options.closeControl), function (button) {
			button.addEventListener('click', function () { dialog.close(); });
		});
		dialog.addEventListener('click', function (event) {
			if (event.target === dialog) dialog.close();
		});
		dialog.addEventListener('close', function () {
			if (options.afterClose) options.afterClose();
			if (activeTrigger && document.contains(activeTrigger)) activeTrigger.focus();
			activeTrigger = null;
		});
	}

	function initDialog(dialog) {
		if (typeof dialog.showModal !== 'function') return;
		var identifier = dialog.id;
		var triggers = identifier ? document.querySelectorAll('[data-mjl-dialog-open="' + identifier + '"]') : [];
		if (!triggers.length) return;
		dialog.removeAttribute('open');
		dialog.classList.add('mjl-dialog-enhanced');
		initNativeDialog(dialog, { triggers: triggers, closeControl: '[data-mjl-dialog-close]' });
	}

	function initExceptionDialog(dialog) {
		if (typeof dialog.showModal !== 'function') return;
		var triggers = document.querySelectorAll('[data-mjl-exception-open]');
		var usableTriggers = [];
		var title = dialog.querySelector('[data-exception-dialog-title]');
		var context = dialog.querySelector('[data-exception-dialog-context]');
		var guidance = dialog.querySelector('[data-exception-dialog-guidance]');
		var host = dialog.querySelector('[data-exception-dialog-form]');
		var activeSource = null;
		var activeForm = null;

		Array.prototype.forEach.call(triggers, function (trigger) {
			var source = document.getElementById(trigger.dataset.exceptionSource || '');
			if (!source || !source.matches('[data-mjl-exception-source]') || !source.querySelector('form')) return;
			trigger.classList.add('mjl-exception-trigger-enhanced');
			source.classList.add('mjl-exception-source-enhanced');
			usableTriggers.push(trigger);
		});
		if (!usableTriggers.length) return;
		dialog.classList.add('mjl-dialog-enhanced');

		initNativeDialog(dialog, {
			triggers: usableTriggers,
			closeControl: '[data-mjl-exception-close]',
			focusTarget: '[data-exception-dialog-form] textarea, [data-exception-dialog-form] button[type="submit"]',
			beforeOpen: function (trigger) {
				activeSource = document.getElementById(trigger.dataset.exceptionSource || '');
				activeForm = activeSource ? activeSource.querySelector('form') : null;
				title.textContent = trigger.dataset.exceptionTitle || 'Action exceptionnelle';
				context.textContent = trigger.dataset.exceptionContext || '';
				guidance.textContent = trigger.dataset.exceptionGuidance || '';
				if (activeForm) host.appendChild(activeForm);
			},
			afterClose: function () {
				if (activeSource && activeForm) activeSource.appendChild(activeForm);
				activeSource = null;
				activeForm = null;
			}
		});
	}

	function initOperationDrawer(dialog) {
		var triggers = document.querySelectorAll('[data-mjl-operation-consult]');
		if (!triggers.length) return;
		var status = dialog.querySelector('[data-operation-drawer-status]');
		var activityLink = dialog.querySelector('[data-operation-drawer-activity-link]');
		var executionLink = dialog.querySelector('[data-operation-drawer-execution-link]');
		var fields = {
			name: '[data-operation-drawer-name]',
			activity: '[data-operation-drawer-activity]',
			type: '[data-operation-drawer-type]',
			authorizationLabel: '[data-operation-drawer-authorization-label]',
			authorized: '[data-operation-drawer-authorized]',
			spent: '[data-operation-drawer-spent]',
			difference: '[data-operation-drawer-difference]',
			variance: '[data-operation-drawer-variance]',
			observation: '[data-operation-drawer-observation]'
		};

		function assign(selector, value) {
			var target = dialog.querySelector(selector);
			if (target) target.textContent = value || '';
		}

		initNativeDialog(dialog, {
			triggers: triggers,
			closeControl: '[data-operation-drawer-close]',
			focusTarget: '[data-operation-drawer-close]',
			beforeOpen: function (trigger) {
				Object.keys(fields).forEach(function (key) {
					assign(fields[key], trigger.dataset['operation' + key.charAt(0).toUpperCase() + key.slice(1)]);
				});
				status.className = 'mjl-status-pill mjl-status-' + (trigger.dataset.operationStatusTone || 'neutral');
				status.textContent = trigger.dataset.operationStatus || '';
				activityLink.href = trigger.dataset.operationActivityHref || '#';
				var executionHref = trigger.dataset.operationExecutionHref || '';
				executionLink.hidden = executionHref === '';
				if (executionHref !== '') executionLink.href = executionHref;
			}
		});
	}


	function initReferencePageDialog(dialog) {
		if (typeof dialog.showModal !== 'function') return;
		var cancelHref = dialog.getAttribute('data-mjl-reference-cancel-href') || '';

		function requestLeave(restoreTarget) {
			if (cancelHref === '') return;
			var form = dialog.querySelector('form[data-mjl-substantive]');
			if (form) {
				var event = new CustomEvent('mjl:request-leave', {
					bubbles: false,
					cancelable: true,
					detail: {
						href: cancelHref,
						restoreTarget: restoreTarget,
						leave: function () { window.location.assign(cancelHref); },
					},
				});
				if (!form.dispatchEvent(event)) return;
			}
			window.location.assign(cancelHref);
		}

		dialog.removeAttribute('open');
		dialog.classList.add('mjl-dialog-enhanced');
		Array.prototype.forEach.call(dialog.querySelectorAll('[data-mjl-reference-dialog-close]'), function (control) {
			control.addEventListener('click', function (event) {
				event.preventDefault();
				requestLeave(control);
			});
		});
		dialog.addEventListener('click', function (event) {
			if (event.target === dialog) requestLeave(document.activeElement);
		});
		dialog.addEventListener('cancel', function (event) {
			event.preventDefault();
			requestLeave(document.activeElement);
		});
		dialog.showModal();
		var focusTarget = dialog.querySelector('[data-mjl-error-summary]') || dialog.querySelector('input, select, textarea, button[type="submit"]');
		if (focusTarget) focusTarget.focus();
	}

	function initReferenceLifecycleDialog(dialog) {
		if (typeof dialog.showModal !== 'function') return;
		var triggers = document.querySelectorAll('[data-mjl-reference-lifecycle-open]');
		var usableTriggers = [];
		var title = dialog.querySelector('[data-reference-dialog-title]');
		var context = dialog.querySelector('[data-reference-dialog-context]');
		var guidance = dialog.querySelector('[data-reference-dialog-guidance]');
		var host = dialog.querySelector('[data-reference-dialog-form]');
		var activeSource = null;
		var activeForm = null;
		var activeSubmit = null;
		var originalSubmitLabel = '';

		Array.prototype.forEach.call(triggers, function (trigger) {
			var source = document.getElementById(trigger.getAttribute('data-reference-source') || '');
			if (!source || !source.matches('[data-mjl-reference-lifecycle-source]') || !source.querySelector('form')) return;
			trigger.classList.add('mjl-reference-lifecycle-trigger-enhanced');
			source.classList.add('mjl-reference-lifecycle-source-enhanced');
			usableTriggers.push(trigger);
		});
		if (!usableTriggers.length) return;
		dialog.classList.add('mjl-dialog-enhanced');

		initNativeDialog(dialog, {
			triggers: usableTriggers,
			closeControl: '[data-mjl-reference-lifecycle-close]',
			focusTarget: '[data-reference-dialog-form] button[type="submit"]',
			beforeOpen: function (trigger) {
				activeSource = document.getElementById(trigger.getAttribute('data-reference-source') || '');
				activeForm = activeSource ? activeSource.querySelector('form') : null;
				title.textContent = trigger.getAttribute('data-reference-title') || 'Modifier le statut';
				context.textContent = trigger.getAttribute('data-reference-context') || '';
				guidance.textContent = trigger.getAttribute('data-reference-guidance') || '';
				if (activeForm) {
					activeSubmit = activeForm.querySelector('button[type="submit"]');
					if (activeSubmit) {
						originalSubmitLabel = activeSubmit.textContent;
						activeSubmit.textContent = trigger.getAttribute('data-reference-confirm-label') || originalSubmitLabel;
					}
					host.appendChild(activeForm);
				}
			},
			afterClose: function () {
				if (activeSubmit) activeSubmit.textContent = originalSubmitLabel;
				if (activeSource && activeForm) activeSource.appendChild(activeForm);
				activeSource = null;
				activeForm = null;
				activeSubmit = null;
				originalSubmitLabel = '';
			}
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		Array.prototype.forEach.call(document.querySelectorAll('.mjl-module-shell'), initNavigationDrawer);
		Array.prototype.forEach.call(document.querySelectorAll('form[data-mjl-validate]'), initValidatedForm);
		initSubstantiveForms(document.querySelectorAll('form[data-mjl-substantive]'));
		initTableActionMenus(document.querySelectorAll('[data-mjl-action-menu]'));
		Array.prototype.forEach.call(document.querySelectorAll('[data-mjl-tabs]'), initTabs);
		Array.prototype.forEach.call(document.querySelectorAll('[data-mjl-dialog]'), function (dialog) { initAssignmentDialog(dialog); initDialog(dialog); });
		Array.prototype.forEach.call(document.querySelectorAll('[data-mjl-operation-drawer]'), initOperationDrawer);
		Array.prototype.forEach.call(document.querySelectorAll('[data-mjl-exception-dialog]'), initExceptionDialog);
		Array.prototype.forEach.call(document.querySelectorAll('[data-mjl-reference-page-dialog]'), initReferencePageDialog);
		Array.prototype.forEach.call(document.querySelectorAll('[data-mjl-reference-lifecycle-dialog]'), initReferenceLifecycleDialog);
	});
})();

(function () {
	'use strict';

	function updateScopedSelect(select, projectId, allowEmptyProject) {
		if (!select) return;
		var selectedOption = select.options[select.selectedIndex];
		var selectedStillAllowed = true;

		Array.prototype.forEach.call(select.options, function (option) {
			if (option.value === '') {
				option.disabled = false;
				option.hidden = false;
				return;
			}

			var optionProjectId = option.getAttribute('data-project-id') || '';
			var allowed = projectId === '' || optionProjectId === projectId || (allowEmptyProject && optionProjectId === '');
			option.disabled = !allowed;
			option.hidden = !allowed;
			if (option.selected && !allowed) selectedStillAllowed = false;
		});

		if (!selectedStillAllowed || (selectedOption && selectedOption.disabled)) {
			select.value = '';
		}
	}

	function initActivityCreateForm(form) {
		var projectSelect = form.querySelector('select[name="fk_project"]');
		var conventionSelect = form.querySelector('select[name="fk_convention"]');
		var taskSelect = form.querySelector('select[name="fk_task"]');
		if (!projectSelect) return;

		function syncLinkedOptions() {
			var projectId = projectSelect.value || '';
			updateScopedSelect(conventionSelect, projectId, true);
			updateScopedSelect(taskSelect, projectId, false);
		}

		projectSelect.addEventListener('change', syncLinkedOptions);
		syncLinkedOptions();
	}

	document.addEventListener('DOMContentLoaded', function () {
		Array.prototype.forEach.call(document.querySelectorAll('form.mjl-activity-form'), function (form) {
			if (form.querySelector('input[name="action"][value="create"]')) {
				initActivityCreateForm(form);
			}
		});
	});
})();

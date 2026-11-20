export const requiredFieldFeedbackStyles = [
  "[:where(&_input[data-value-missing='true'])]:border-danger",
  "[:where(&_select[data-value-missing='true'])]:border-danger",
  "[:where(&_textarea[data-value-missing='true'])]:border-danger",
  "[:where(&_button[data-value-missing='true'])]:border-danger",
  "[:where(&_label:has([data-value-missing='true']))]:after:content-['Ce_champ_est_obligatoire.']",
  "[:where(&_label:has([data-value-missing='true']))]:after:text-xs",
  "[:where(&_label:has([data-value-missing='true']))]:after:font-normal",
  "[:where(&_label:has([data-value-missing='true']))]:after:text-danger",
]

export function markMissingRequiredField(event) {
  if (!event.target.validity?.valueMissing) return
  event.target.dataset.valueMissing = 'true'
  event.target.setAttribute('aria-invalid', 'true')
}

export function clearMissingRequiredField(event) {
  if (event.target.validity?.valueMissing) return
  delete event.target.dataset.valueMissing
  if (event.target.validity?.valid) event.target.removeAttribute('aria-invalid')
}

export const requiredFieldFeedbackHandlers = {
  onInvalidCapture: markMissingRequiredField,
  onChangeCapture: clearMissingRequiredField,
}

export function missingRequiredFieldProps(missing) {
  return missing ? { 'data-value-missing': 'true', 'aria-invalid': 'true' } : {}
}

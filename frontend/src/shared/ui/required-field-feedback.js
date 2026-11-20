export const requiredFieldFeedbackStyles = [
  "[:where(&_input[data-value-missing='true'])]:border-danger",
  "[:where(&_select[data-value-missing='true'])]:border-danger",
  "[:where(&_textarea[data-value-missing='true'])]:border-danger",
  "[:where(&_button[data-value-missing='true'])]:border-danger",
]

export const requiredFieldMessage = 'Ce champ est obligatoire.'

let requiredErrorSequence = 0

function requiredErrorId(target) {
  if (target.dataset.requiredErrorId) return target.dataset.requiredErrorId
  requiredErrorSequence += 1
  const id = `required-field-error-${requiredErrorSequence}`
  target.dataset.requiredErrorId = id
  return id
}

function appendDescription(target, id) {
  const describedBy = (target.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(Boolean)
  if (!describedBy.includes(id)) describedBy.push(id)
  target.setAttribute('aria-describedby', describedBy.join(' '))
}

function ensureRequiredError(target) {
  const container = target.closest('label') || target.parentElement
  if (!container) return
  const id = requiredErrorId(target)
  appendDescription(target, id)
  if (target.ownerDocument.getElementById(id)) return
  const error = target.ownerDocument.createElement('span')
  error.id = id
  error.className = 'text-xs font-normal text-danger'
  error.setAttribute('role', 'alert')
  error.dataset.requiredFieldError = 'true'
  error.textContent = requiredFieldMessage
  container.append(error)
}

function removeRequiredError(target) {
  const id = target.dataset.requiredErrorId
  if (!id) return
  target.ownerDocument.getElementById(id)?.remove()
  const describedBy = (target.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter((value) => value && value !== id)
  if (describedBy.length)
    target.setAttribute('aria-describedby', describedBy.join(' '))
  else target.removeAttribute('aria-describedby')
  delete target.dataset.requiredErrorId
}

export function markMissingRequiredField(event) {
  if (!event.target.validity?.valueMissing) return
  event.target.dataset.valueMissing = 'true'
  event.target.setAttribute('aria-invalid', 'true')
  ensureRequiredError(event.target)
}

export function clearMissingRequiredField(event) {
  if (event.target.validity?.valueMissing) return
  delete event.target.dataset.valueMissing
  if (event.target.validity?.valid) event.target.removeAttribute('aria-invalid')
  removeRequiredError(event.target)
}

export const requiredFieldFeedbackHandlers = {
  onInvalidCapture: markMissingRequiredField,
  onChangeCapture: clearMissingRequiredField,
}

export function missingRequiredFieldProps(missing, errorId) {
  return missing
    ? {
        'data-value-missing': 'true',
        'aria-invalid': 'true',
        ...(errorId ? { 'aria-describedby': errorId } : {}),
      }
    : {}
}

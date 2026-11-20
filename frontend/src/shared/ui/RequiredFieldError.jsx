import { requiredFieldMessage } from './required-field-feedback'

export function RequiredFieldError({ id, show }) {
  if (!show) return null
  return (
    <span id={id} className="text-xs font-normal text-danger" role="alert">
      {requiredFieldMessage}
    </span>
  )
}

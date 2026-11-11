import { businessActionClassName } from '@/shared/ui/button-variants'
import { Link } from '@tanstack/react-router'
import { workspacePath } from '../session/authorization'
import { FallbackState } from '@/shared/ui/FallbackState'
import { strings } from '@/locales/fr/common'

export function AccessDeniedState({ role }) {
  return (
    <FallbackState
      title={strings.accessDenied}
      action={
        <Link to={workspacePath(role)} className={businessActionClassName}>
          {strings.returnToWorkspace}
        </Link>
      }
    >
      <p>{strings.accessDeniedMessage}</p>
    </FallbackState>
  )
}

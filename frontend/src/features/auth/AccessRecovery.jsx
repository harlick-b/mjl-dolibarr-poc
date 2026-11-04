import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { strings } from '@/shared/i18n'

export function AccessRecovery({ session, onVerified }) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  return (
    <>
      <Button
        disabled={checking}
        onClick={async () => {
          if (!navigator.onLine) {
            setError(strings.reconnectRetry)
            return
          }
          setChecking(true)
          setError('')
          const result = await session.refetch()
          setChecking(false)
          if (!result.isError && navigator.onLine) onVerified()
          else setError(strings.identityUnavailable)
        }}
      >
        {checking ? strings.checkingAccess : strings.verifyAccess}
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

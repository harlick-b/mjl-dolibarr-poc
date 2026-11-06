/* eslint-disable react-refresh/only-export-components -- one logout context and its consumer. */
import { createContext, useContext, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useAccess, broadcastAuthenticationChange } from './access-verification'
import { PageLoading } from '@/shared/ui/PageLoading'
import { FallbackState } from '@/shared/ui/FallbackState'
import { buttonVariants } from '@/shared/ui/button-variants'
import { strings } from '@/locales/fr/AuthView'

const LogoutContext = createContext(null)
export function LogoutProvider({ children }) {
  const access = useAccess()
  const { api } = useAPI()
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const mutation = useMutation({
    mutationKey: ['auth', 'logout'],
    retry: false,
    networkMode: 'always',
    mutationFn: (csrf) => api.auth('logout', { body: {}, csrf }),
    meta: { localError: true },
  })
  async function logout() {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(false)
    let csrf = access.session?.csrf
    const held = access.reason === 'logout'
    access.holdLogout(csrf)
    try {
      if (held || !csrf) csrf = await access.prepareLogout()
      await mutation.mutateAsync(csrf)
      broadcastAuthenticationChange()
      access.releaseLogout()
      const fresh = await access.verify({
        manual: true,
        reason: 'logout-complete',
      })
      if (fresh?.state !== 'anonymous') {
        access.holdLogout(fresh?.csrf)
        throw new Error('Logout context changed')
      }
    } catch {
      setError(true)
    } finally {
      running.current = false
      setBusy(false)
      mutation.reset()
    }
  }
  return (
    <LogoutContext.Provider value={{ logout, busy, error }}>
      {children}
    </LogoutContext.Provider>
  )
}
export const useLogout = () => useContext(LogoutContext)

export function LogoutScreen() {
  const { logout, busy } = useLogout()
  return (
    <main
      className="min-h-dvh grid place-items-center bg-background px-6"
      data-ui="logout-screen"
    >
      {busy ? (
        <PageLoading
          title={strings.logoutHeading}
          label={strings.logoutHeading}
          className="min-h-0"
        />
      ) : (
        <FallbackState
          title={strings.logoutHeading}
          action={
            <button type="button" className={buttonVariants()} onClick={logout}>
              {strings.retryLogout}
            </button>
          }
        >
          <p>{strings.logoutUnconfirmed}</p>
        </FallbackState>
      )}
    </main>
  )
}

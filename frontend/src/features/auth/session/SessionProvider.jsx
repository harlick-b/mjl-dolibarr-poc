/* eslint-disable react-refresh/only-export-components -- provider and hook expose one query-backed session. */
import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionQuery } from './auth'

const SessionContext = createContext(null)

// Query owns the data; context shares its observer, never a copied session.
// The access coordinator controls verification and writes the validated result.
export function SessionProvider({ children }) {
  const session = useQuery(sessionQuery)
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSessionQuery() {
  const session = useContext(SessionContext)
  if (!session)
    throw new Error('useSessionQuery must be used inside SessionProvider')
  return session
}

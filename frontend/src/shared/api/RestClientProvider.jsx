import { createContext, useContext } from 'react'
import { api } from './rest-client'

const RestClientContext = createContext(null)

export function RestClientProvider({ children, client = api }) {
  return (
    <RestClientContext.Provider value={{ api: client }}>
      {children}
    </RestClientContext.Provider>
  )
}

// The hook is the provider's public interface and intentionally colocated.
// eslint-disable-next-line react-refresh/only-export-components
export function useAPI() {
  const value = useContext(RestClientContext)
  if (!value) throw new Error('useAPI must be used inside RestClientProvider')
  return value
}

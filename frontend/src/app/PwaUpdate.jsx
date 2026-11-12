import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Urls } from '@/app/urls'

function openUpdatedLogin(path) {
  window.location.replace(path)
}

export function PwaUpdate({ onActivated = openUpdatedLogin }) {
  const activationStarted = useRef(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: () => onActivated(Urls.logout),
  })

  useEffect(() => {
    if (!needRefresh || activationStarted.current) return
    activationStarted.current = true
    void updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  return null
}

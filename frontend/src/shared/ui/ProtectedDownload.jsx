import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { Button } from './button'

export function ProtectedDownload({
  path,
  children,
  className,
  size,
  onDenied,
  scope,
}) {
  const { api } = useAPI()
  const controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  const download = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async () => {
      const scopeSignal = scope?.current.signal
      controller.current = new AbortController()
      const current = controller.current
      const abort = () => current.abort()
      if (scopeSignal?.aborted) abort()
      scopeSignal?.addEventListener('abort', abort, { once: true })
      try {
        const result = await api.download(path, { signal: current.signal })
        if (current.signal.aborted)
          throw new DOMException('Cancelled download', 'AbortError')
        return { ...result, deliverySignal: current.signal, scopeSignal }
      } finally {
        scopeSignal?.removeEventListener('abort', abort)
      }
    },
    onError: (error) => {
      if ([403, 404].includes(error.status)) onDenied?.()
    },
    onSuccess: ({
      blob,
      filename,
      deliverySignal,
      scopeSignal: requestScope,
    }) => {
      if (deliverySignal.aborted || requestScope?.aborted) return
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
    },
  })
  return (
    <Button
      className={className}
      disabled={download.isPending}
      onClick={() => download.mutate()}
      type="button"
      variant="outline"
      size={size}
    >
      {children}
    </Button>
  )
}

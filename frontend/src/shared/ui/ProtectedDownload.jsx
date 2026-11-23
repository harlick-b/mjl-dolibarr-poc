import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { deliverBlobDownload } from '@/shared/lib/download'
import { Button } from './button'

export function ProtectedDownload({
  path,
  children,
  className,
  size,
  variant = 'outline',
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
      if ([401, 403, 404].includes(error.status)) onDenied?.(error.status)
    },
    onSuccess: ({
      blob,
      filename,
      deliverySignal,
      scopeSignal: requestScope,
    }) => {
      if (deliverySignal.aborted || requestScope?.aborted) return
      deliverBlobDownload({ blob, filename })
    },
  })
  return (
    <Button
      className={className}
      disabled={download.isPending}
      onClick={() => download.mutate()}
      type="button"
      variant={variant}
      size={size}
    >
      {children}
    </Button>
  )
}

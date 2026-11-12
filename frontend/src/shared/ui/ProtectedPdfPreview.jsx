import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { strings as common } from '@/locales/fr/common'
import { Button } from './button'
import { Modal } from './BusinessModal'
import { LoadingPlaceholder } from './PageLoading'
import { RetryableError } from './RetryableError'

export function ProtectedPdfPreview({
  path,
  title,
  children,
  className,
  size,
  onDenied,
  scope,
}) {
  const { api } = useAPI()
  const controller = useRef(null)
  const opener = useRef(null)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(null)

  useEffect(() => () => controller.current?.abort(), [])
  const scopeSignal = scope?.signal || scope?.current?.signal
  useEffect(() => {
    const abort = () => {
      controller.current?.abort()
      setPreview(null)
      setOpen(false)
    }
    if (scopeSignal?.aborted) abort()
    scopeSignal?.addEventListener('abort', abort)
    return () => scopeSignal?.removeEventListener('abort', abort)
  }, [scopeSignal])
  useEffect(() => {
    const href = preview?.href
    return () => {
      if (href) URL.revokeObjectURL(href)
    }
  }, [preview?.href])

  const request = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async () => {
      const scopeSignal = scope?.signal || scope?.current?.signal
      controller.current = new AbortController()
      const current = controller.current
      const abort = () => current.abort()
      if (scopeSignal?.aborted) abort()
      scopeSignal?.addEventListener('abort', abort, { once: true })
      try {
        const result = await api.download(path, { signal: current.signal })
        if (current.signal.aborted)
          throw new DOMException('Cancelled preview', 'AbortError')
        return { ...result, scopeSignal }
      } finally {
        scopeSignal?.removeEventListener('abort', abort)
      }
    },
    onError: (error) => {
      if ([403, 404].includes(error.status)) onDenied?.(error.status)
    },
    onSuccess: ({ blob, filename, scopeSignal }) => {
      if (controller.current?.signal.aborted || scopeSignal?.aborted) return
      setPreview({ href: URL.createObjectURL(blob), filename })
    },
  })

  const download = () => {
    const anchor = document.createElement('a')
    anchor.href = preview.href
    anchor.download = preview.filename
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  }

  const close = () => {
    controller.current?.abort()
    request.reset()
    setPreview(null)
    setOpen(false)
  }

  return (
    <>
      <Button
        ref={opener}
        className={className}
        disabled={request.isPending}
        onClick={() => {
          setOpen(true)
          request.mutate()
        }}
        type="button"
        variant="outline"
        size={size}
      >
        {children}
      </Button>
      <Modal
        open={open}
        onClose={close}
        label={title}
        opener={opener}
        className="w-[min(960px,calc(100%-32px))]"
      >
        <div className="grid gap-5 p-6">
          {request.isPending && (
            <LoadingPlaceholder label={common.previewLoading} />
          )}
          {request.isError && (
            <RetryableError onRetry={() => request.mutate()}>
              {common.dataUnavailable}
            </RetryableError>
          )}
          {preview && (
            <iframe
              title={`${title} — ${common.preview}`}
              src={preview.href}
              className="h-[min(70dvh,760px)] w-full rounded-control border border-border bg-background"
            />
          )}
          <div data-ui="modal-actions">
            <Button type="button" variant="outline" onClick={close}>
              {common.dismiss}
            </Button>
            {preview && (
              <Button type="button" onClick={download}>
                {common.download}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

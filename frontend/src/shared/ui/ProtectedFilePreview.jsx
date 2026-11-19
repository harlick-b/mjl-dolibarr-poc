import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { strings as common } from '@/locales/fr/common'
import { Button } from './button'
import { Modal } from './BusinessModal'
import { LoadingPlaceholder } from './PageLoading'
import { RetryableError } from './RetryableError'
import { ProtectedDownload } from './ProtectedDownload'

export function ProtectedFilePreview({
  path,
  title,
  children,
  className,
  size,
  kind = 'image',
  onDenied,
  scope,
  download = true,
  downloadPath,
  errorMessage = common.dataUnavailable,
  ...buttonProps
}) {
  const { api } = useAPI()
  const controller = useRef(null)
  const opener = useRef(null)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  const scopeSignal = scope?.signal || scope?.current?.signal

  useEffect(() => () => controller.current?.abort(), [])
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
      controller.current = new AbortController()
      const current = controller.current
      const abort = () => current.abort()
      if (scopeSignal?.aborted) abort()
      scopeSignal?.addEventListener('abort', abort, { once: true })
      try {
        const result = await api.download(path, { signal: current.signal })
        if (current.signal.aborted)
          throw new DOMException('Cancelled preview', 'AbortError')
        return result
      } finally {
        scopeSignal?.removeEventListener('abort', abort)
      }
    },
    onError: (error) => {
      if ([401, 403, 404].includes(error.status)) onDenied?.(error.status)
    },
    onSuccess: ({ blob, filename }) => {
      if (controller.current?.signal.aborted || scopeSignal?.aborted) return
      setPreview({ href: URL.createObjectURL(blob), filename })
    },
  })

  const close = () => {
    controller.current?.abort()
    request.reset()
    setPreview(null)
    setOpen(false)
  }
  const save = () => {
    const anchor = document.createElement('a')
    anchor.href = preview.href
    anchor.download = preview.filename
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  }

  return (
    <>
      <Button
        {...buttonProps}
        ref={opener}
        className={className}
        loading={request.isPending}
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
        label={kind === 'image' ? `${common.preview} — ${title}` : title}
        opener={opener}
        className="w-[min(960px,calc(100%-32px))]"
      >
        <div className="grid gap-5 p-6">
          {request.isPending && (
            <LoadingPlaceholder
              label={common.previewLoading}
              variant="preview"
            />
          )}
          {request.isError && request.error?.name !== 'AbortError' && (
            <RetryableError onRetry={() => request.mutate()}>
              {typeof errorMessage === 'function'
                ? errorMessage(request.error)
                : errorMessage}
            </RetryableError>
          )}
          {preview && kind === 'image' && (
            <img
              src={preview.href}
              alt={`${common.preview} de ${title}`}
              className="max-h-[65dvh] w-full rounded-control border border-border bg-background object-contain"
            />
          )}
          {preview && kind === 'pdf' && (
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
            {preview && downloadPath && (
              <ProtectedDownload
                path={downloadPath}
                onDenied={onDenied}
                scope={scope}
              >
                {common.download}
              </ProtectedDownload>
            )}
            {preview && download && !downloadPath && (
              <Button type="button" onClick={save}>
                {common.download}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

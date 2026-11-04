import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye } from 'lucide-react'
import { useAPI } from '@/shared/api/RestClientProvider'
import { Button } from '@/shared/ui/button'
import { Modal } from '@/shared/ui/BusinessModal'
import { strings } from '@/shared/i18n'
import { cursorFrom } from '@/shared/lib/pagination'

export function PartnerDocuments({
  activityId,
  userId,
  cursor,
  changeCursor,
  guard,
  onDenied,
}) {
  const { api } = useAPI()
  const client = useQueryClient()
  const [preview, setPreview] = useState(null)
  const opener = useRef(null)
  const url = useRef('')
  const activeFile = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const base = `/api/v1/partner-portal/activities/${activityId}/documents`
  const key = ['partner-portal', userId, 'documents', activityId, cursor]
  const release = () => {
    guard.revoke()
    if (url.current) URL.revokeObjectURL(url.current)
    guard.urls.delete(url.current)
    url.current = ''
    activeFile.current = null
  }
  useEffect(
    () => () => {
      guard.revoke()
    },
    [guard],
  )
  const documents = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      try {
        const page = await api.request(
          `${base}?${new URLSearchParams({ limit: '60', ...(cursor ? { cursor } : {}) })}`,
          { signal },
        )
        if (signal.aborted)
          throw new DOMException('Cancelled list', 'AbortError')
        if (
          activeFile.current &&
          !page.data.some((file) => file.id === activeFile.current)
        ) {
          guard.revoke()
          activeFile.current = null
        }
        return page
      } catch (error) {
        if (signal.aborted || error.name === 'AbortError') throw error
        guard.revoke()
        if ([401, 403].includes(error.status)) onDenied(error.status)
        throw error
      }
    },
    retry: false,
    gcTime: 0,
  })
  const bytes = useMutation({
    retry: false,
    networkMode: 'always',
    gcTime: 0,
    mutationFn: async ({ file, inline, request }) => {
      if (!navigator.onLine) throw new TypeError('Offline')
      const result = await api.download(
        `${base}/${file.id}/${inline ? 'preview' : 'download'}`,
        { signal: request.signal },
      )
      if (!guard.current(request.generation))
        throw new DOMException('Stale authorization', 'AbortError')
      const href = URL.createObjectURL(result.blob)
      if (inline) {
        guard.urls.add(href)
        url.current = href
        setPreviewUrl(href)
      } else {
        const anchor = document.createElement('a')
        anchor.href = href
        anchor.download = result.filename
        document.body.append(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(href), 0)
      }
      return null
    },
    onError: async (error, { request }) => {
      if (!guard.current(request.generation)) return
      release()
      setPreviewUrl('')
      if ([401, 403].includes(error.status)) onDenied(error.status)
      if (error.status === 404)
        await client.invalidateQueries({
          queryKey: ['partner-portal', userId, 'documents', activityId],
        })
    },
  })
  const close = () => {
    release()
    setPreviewUrl('')
    setPreview(null)
    bytes.reset()
  }
  const page = documents.data
  const previousCursor = cursorFrom(
    page?.previous,
    `/partner-portal/activities/${activityId}/documents`,
  )
  const nextCursor = cursorFrom(
    page?.next,
    `/partner-portal/activities/${activityId}/documents`,
  )

  return (
    <section aria-label={strings.sharedAttachments}>
      <h3>{strings.sharedAttachments}</h3>
      {documents.isPending ? (
        <p role="status">Chargement…</p>
      ) : documents.isError ? (
        <p role="alert">{strings.sharedFileUnavailable}</p>
      ) : !page?.data.length ? (
        <p>{strings.noSharedAttachments}</p>
      ) : (
        <ul className="planning-list">
          {page.data.map((file) => (
            <li key={file.id}>
              <span>
                {file.name}
                <small>
                  {file.media_type} ·{' '}
                  {new Intl.NumberFormat('fr-FR').format(file.size)} octets
                </small>
              </span>
              <div className="planning-actions">
                {['image/png', 'image/jpeg'].includes(file.media_type) && (
                  <Button
                    variant="outline"
                    disabled={bytes.isPending}
                    onClick={(event) => {
                      opener.current = event.currentTarget
                      release()
                      setPreviewUrl('')
                      setPreview(file)
                      activeFile.current = file.id
                      bytes.mutate({
                        file,
                        inline: true,
                        request: guard.begin(),
                      })
                    }}
                  >
                    <Eye aria-hidden="true" />
                    {strings.preview}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={bytes.isPending}
                  onClick={() => {
                    activeFile.current = file.id
                    bytes.mutate({
                      file,
                      inline: false,
                      request: guard.begin(),
                    })
                  }}
                >
                  <Download aria-hidden="true" />
                  {strings.download}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {bytes.isError && bytes.error?.name !== 'AbortError' && (
        <p role="alert">{strings.sharedFileUnavailable}</p>
      )}
      {(page?.next || page?.previous) && (
        <nav
          className="access-pagination"
          aria-label="Pagination des documents partagés"
        >
          <Button
            disabled={!previousCursor || documents.isFetching}
            onClick={() => {
              close()
              changeCursor(previousCursor)
            }}
          >
            {strings.previous}
          </Button>
          <Button
            disabled={!nextCursor || documents.isFetching}
            onClick={() => {
              close()
              changeCursor(nextCursor)
            }}
          >
            {strings.next}
          </Button>
        </nav>
      )}
      <Modal
        open={Boolean(preview)}
        onClose={close}
        label={
          preview ? `${strings.preview} — ${preview.name}` : strings.preview
        }
        opener={opener}
        className="document-preview-dialog"
      >
        {preview && (
          <div className="document-preview">
            <h3>{preview.name}</h3>
            {bytes.isPending ? (
              <p role="status">Chargement de l’aperçu…</p>
            ) : previewUrl &&
              !documents.isError &&
              page?.data.some((file) => file.id === preview.id) ? (
              <img
                src={previewUrl}
                alt={`${strings.preview} de ${preview.name}`}
              />
            ) : (
              <p role="alert">{strings.sharedFileUnavailable}</p>
            )}
            <div className="modal-actions">
              <Button variant="outline" onClick={close}>
                {strings.dismiss}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

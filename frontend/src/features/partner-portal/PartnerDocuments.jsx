import { EmptyContent } from '@/shared/ui/EmptyContent'
import { LoadingPlaceholder } from '@/shared/ui/PageLoading'
import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye } from 'lucide-react'
import { useAPI } from '@/shared/api/RestClientProvider'
import { strings } from '@/locales/fr/PartnerDocuments'
import { strings as common } from '@/locales/fr/common'
import { cursorFrom } from '@/shared/lib/pagination'
import { Pagination } from '@/shared/ui/Pagination'
import { ProtectedDownload } from '@/shared/ui/ProtectedDownload'
import { ProtectedFilePreview } from '@/shared/ui/ProtectedFilePreview'

export function PartnerDocuments({
  activityId,
  userId,
  cursor,
  changeCursor,
  onDenied,
}) {
  const { api } = useAPI()
  const client = useQueryClient()
  const deliveryScope = useRef(new AbortController())
  const base = `/api/v1/partner-portal/activities/${activityId}/documents`
  const key = ['partner-portal', userId, 'documents', activityId, cursor]
  useEffect(
    () => () => {
      deliveryScope.current.abort()
    },
    [],
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
        deliveryScope.current.abort()
        deliveryScope.current = new AbortController()
        return page
      } catch (error) {
        if (signal.aborted || error.name === 'AbortError') throw error
        deliveryScope.current.abort()
        deliveryScope.current = new AbortController()
        if ([401, 403].includes(error.status)) onDenied(error.status)
        throw error
      }
    },
    retry: false,
    gcTime: 0,
  })
  const denyFile = async (status) => {
    if ([401, 403].includes(status)) onDenied(status)
    if (status === 404)
      await client.invalidateQueries({
        queryKey: ['partner-portal', userId, 'documents', activityId],
      })
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
        <LoadingPlaceholder label={common.documentsLoading} />
      ) : documents.isError ? (
        <p role="alert">{strings.sharedFileUnavailable}</p>
      ) : !page?.data.length ? (
        <EmptyContent kind="sharedDocuments" />
      ) : (
        <ul
          className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
          data-ui="planning-list"
        >
          {page.data.map((file) => (
            <li key={file.id}>
              <span>
                {file.name}
                <small>
                  {file.media_type} ·{' '}
                  {new Intl.NumberFormat('fr-FR').format(file.size)} octets
                </small>
              </span>
              <div className="flex gap-2 items-end flex-wrap">
                {['image/png', 'image/jpeg'].includes(file.media_type) && (
                  <ProtectedFilePreview
                    path={`${base}/${file.id}/preview`}
                    title={file.name}
                    onDenied={denyFile}
                    download={false}
                    scope={deliveryScope}
                    errorMessage={strings.sharedFileUnavailable}
                  >
                    <Eye aria-hidden="true" />
                    {common.preview}
                  </ProtectedFilePreview>
                )}
                <ProtectedDownload
                  path={`${base}/${file.id}/download`}
                  onDenied={denyFile}
                  scope={deliveryScope}
                >
                  <Download aria-hidden="true" />
                  {common.download}
                </ProtectedDownload>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        className="justify-end mt-3 mb-10"
        label="Pagination des documents partagés"
        visible={Boolean(page?.previous || page?.next)}
        canPrevious={Boolean(previousCursor)}
        canNext={Boolean(nextCursor)}
        busy={documents.isFetching}
        onPrevious={() => {
          changeCursor(previousCursor)
        }}
        onNext={() => {
          changeCursor(nextCursor)
        }}
      />
    </section>
  )
}

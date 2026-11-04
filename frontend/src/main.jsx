import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App, makeRouter } from '@/app/router'
import { PwaUpdate } from '@/app/PwaUpdate'
import '@/app/styles.css'

const router = makeRouter()
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App router={router} />
    <PwaUpdate queryClient={router.options.context.queryClient} />
  </StrictMode>,
)

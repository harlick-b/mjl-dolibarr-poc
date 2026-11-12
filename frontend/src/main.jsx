import { createRoot } from 'react-dom/client'
import { App, makeRouter } from '@/app/router'
import { PwaUpdate } from '@/app/PwaUpdate'
import '@/app/tailwind.css'

const router = makeRouter()
createRoot(document.getElementById('root')).render(
  <>
    <App router={router} />
    <PwaUpdate />
  </>,
)

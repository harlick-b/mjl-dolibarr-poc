import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App, makeRouter } from './router'
import { PwaUpdate } from './PwaUpdate'
import './styles.css'

const router = makeRouter()
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App router={router} />
    <PwaUpdate />
  </StrictMode>,
)

/**
 * App entry point. Mounts <App> into #root (declared in index.html) and pulls
 * in the global stylesheet. StrictMode is intentional: it double-invokes
 * effects in development to surface missing cleanup — the canvas hook's
 * teardown is written to survive it (see useWisteriaTunnel).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

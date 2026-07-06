import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installGlobalErrorLogging, logger } from './lib/logger'

installGlobalErrorLogging()
logger.info('Admin app started', { mode: import.meta.env.MODE })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

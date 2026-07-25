import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/hanken-grotesk/wght.css'
import '@fontsource-variable/archivo/wght.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
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

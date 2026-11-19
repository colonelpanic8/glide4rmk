import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyStoredTheme } from './ui/theme'
import { MessageHost } from './ui/messages/MessageHost'
import { flagsFromAddress } from './ui/flags'

applyStoredTheme()
flagsFromAddress(window.location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <MessageHost />
  </StrictMode>,
)

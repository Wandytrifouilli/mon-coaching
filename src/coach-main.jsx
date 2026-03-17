import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CoachApp from './CoachApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CoachApp />
  </StrictMode>,
)

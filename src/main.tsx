import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppRouter } from './app/router'
import './styles/index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontró el elemento #root en index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)

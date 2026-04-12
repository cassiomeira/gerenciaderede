import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// O interceptor global foi removido para evitar conflitos com o apiFetch.
// Agora, todas as comunicações autenticadas são feitas via apiFetch ou networkApi.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

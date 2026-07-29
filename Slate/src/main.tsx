import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/Toast'
import { registerSW } from 'virtual:pwa-register'

// Automatically check for updates and reload when service worker updates
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

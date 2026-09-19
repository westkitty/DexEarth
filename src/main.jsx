import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

// Production shell can restart offline after a successful first installation.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      window.dispatchEvent(new CustomEvent('dexearth:offline-ready'))
    })
    .catch(() => {
      /* Local server + bundled assets remain usable without a worker. */
    })
}

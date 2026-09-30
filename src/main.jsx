import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/500.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/shared/ErrorBoundary.jsx'
import { initAnalytics } from './lib/analytics.js'
import RichTextFieldDemo from './components/shared/RichTextField.demo.jsx'

// GA4 activation tracking — no-op unless VITE_GA_MEASUREMENT_ID is set (prod/preview).
initAnalytics(import.meta.env.VITE_GA_MEASUREMENT_ID)

// Review-only sandbox for the RichTextField PoC — visit /#rtf-demo.
// Harmless in production (just an unreferenced hash route); remove once the
// component ships.
const showRtfDemo = window.location.hash === '#rtf-demo'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary label="root">
      {showRtfDemo ? <RichTextFieldDemo /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)

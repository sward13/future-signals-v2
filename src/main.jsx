import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/500.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import './index.css'
import App from './App.jsx'
import RichTextFieldDemo from './components/shared/RichTextField.demo.jsx'

// Review-only sandbox for the RichTextField PoC — visit /#rtf-demo.
// Harmless in production (just an unreferenced hash route); remove once the
// component ships.
const showRtfDemo = window.location.hash === '#rtf-demo'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {showRtfDemo ? <RichTextFieldDemo /> : <App />}
  </StrictMode>,
)

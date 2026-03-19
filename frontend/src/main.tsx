import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found. Check index.html.')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#111111',
          color: '#FAFAFA',
          border: '1px solid #1F1F1F',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
        },
        success: {
          iconTheme: { primary: '#10B981', secondary: '#111111' },
        },
        error: {
          iconTheme: { primary: '#EF4444', secondary: '#111111' },
        },
      }}
    />
  </React.StrictMode>,
)

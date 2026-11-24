import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AvisoProvider, SessaoProvider } from './lib/contexto'
import './estilos.css'
import './extra.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessaoProvider>
        <AvisoProvider>
          <App />
        </AvisoProvider>
      </SessaoProvider>
    </BrowserRouter>
  </React.StrictMode>
)

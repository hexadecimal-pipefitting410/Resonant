import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppStoreProvider } from './store/AppStore'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<StrictMode><AppStoreProvider><App /></AppStoreProvider></StrictMode>)

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress and swallow benign WebSocket / Vite connection errors in this iframe environment
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && (
      String(reason).includes('WebSocket') || 
      String(reason.message).includes('WebSocket') ||
      String(reason).includes('vite')
    )) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  window.addEventListener('error', (event) => {
    if (event.message && (
      event.message.includes('WebSocket') || 
      event.message.includes('vite')
    )) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

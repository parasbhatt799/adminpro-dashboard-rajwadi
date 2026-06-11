import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ToastProvider } from './context/ToastContext.tsx';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/OneSignalSDKWorker.js', { scope: '/' })
      .then((reg) => {
        console.log('PWA ServiceWorker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.error('PWA ServiceWorker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);

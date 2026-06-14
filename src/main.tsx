import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ToastProvider } from './context/ToastContext.tsx';

// Global error handlers to capture chunk loading / script load failures (e.g. after a new build is deployed)
const handleChunkError = () => {
  const lastReload = sessionStorage.getItem('last_chunk_reload');
  const now = Date.now();
  // Prevent reload loop if server is down or chunk is truly missing
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('last_chunk_reload', now.toString());
    console.warn('[Global] Chunk load error detected. Forcing page reload to fetch new assets...');
    window.location.reload();
  }
};

window.addEventListener('error', (event) => {
  const target = event.target as any;
  if (target && target.tagName === 'SCRIPT') {
    const src = target.src || '';
    if (src.includes('/assets/') || src.includes('chunk')) {
      console.warn('[Global] Failed to load script asset:', src);
      handleChunkError();
    }
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  const errorMsg = (event.reason?.message || event.reason?.toString() || '').toLowerCase();
  if (
    errorMsg.includes('failed to fetch dynamically imported module') ||
    errorMsg.includes('is not a valid javascript mime type') ||
    errorMsg.includes('unexpected token \'<\'') ||
    errorMsg.includes('chunkloaderror')
  ) {
    console.warn('[Global] Unhandled rejection chunk error detected:', errorMsg);
    handleChunkError();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);


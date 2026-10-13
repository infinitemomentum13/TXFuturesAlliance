import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import './index.css';
import App from './App.tsx';

/**
 * Stand-in server: MSW runs in the browser unless VITE_USE_MOCK_API=false.
 * To point at the real back end later: set VITE_USE_MOCK_API=false and
 * VITE_API_BASE_URL to the real server — no screen changes.
 */
async function bootstrap() {
  const useMock = (import.meta.env.VITE_USE_MOCK_API as string | undefined) !== 'false';
  if (useMock) {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledFrame: 'bypass',
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {/* Hash URLs (/pathways/#/career) because Hostinger does not
          rewrite /pathways/career to index.html. */}
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  );
}

void bootstrap();

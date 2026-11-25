import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __markAppMounted?: () => void;
    __reportBootError?: (err: unknown) => void;
  }
}

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Missing #root element');
  createRoot(rootEl).render(<App />);
  window.__markAppMounted?.();
} catch (err) {
  window.__reportBootError?.(err);
  throw err;
}

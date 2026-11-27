import {createRoot} from 'react-dom/client';
import '@flaticon/flaticon-uicons/css/regular/rounded.css';
import App from './App.tsx';
import './index.css';
import {initDesignVersion} from './preview/designVersion';

declare global {
  interface Window {
    __markAppMounted?: () => void;
    __reportBootError?: (err: unknown) => void;
  }
}

try {
  initDesignVersion();
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Missing #root element');
  createRoot(rootEl).render(<App />);
  window.__markAppMounted?.();
} catch (err) {
  window.__reportBootError?.(err);
  throw err;
}

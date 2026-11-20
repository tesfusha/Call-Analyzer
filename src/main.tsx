import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import {isNativeCapacitor} from './lib/capacitor';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  if (isNativeCapacitor()) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
      .catch(() => {});
  } else {
    registerSW({immediate: true});
  }
}

createRoot(document.getElementById('root')!).render(<App />);

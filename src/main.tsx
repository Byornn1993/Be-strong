import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';

// Vraag persistente opslag aan, zodat de browser de lokale data (en een lopende workout) niet zomaar opruimt.
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

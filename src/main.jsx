// src/main.jsx
// Replaces: §28 APP RENDER  (root.render / requestAnimationFrame splash dismiss)
// in index.html.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import GlobalPopup from './components/layout/GlobalPopup';
import { PopupProvider } from './contexts/PopupContext';
import './style.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <PopupProvider>
      <App />
      <GlobalPopup />
    </PopupProvider>
  </React.StrictMode>
);

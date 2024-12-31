import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import App from './App';
import { PopupProvider } from './contexts/PopupContext';
import GlobalPopup from './components/GlobalPopup';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <PopupProvider>
      <App />
      <GlobalPopup />
    </PopupProvider>
  </React.StrictMode>
);

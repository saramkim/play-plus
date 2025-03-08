import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import GlobalPopup from './components/layout/global-popup';
import { PopupProvider } from './contexts/popup-context';
import './style.css';
import { ThemeProvider } from './contexts/theme-provider-context';
import { Toaster } from './components/ui/sonner';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <PopupProvider>
        <App />
        <GlobalPopup />
        <Toaster />
      </PopupProvider>
    </ThemeProvider>
  </React.StrictMode>
);

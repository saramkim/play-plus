import React from 'react';

import ReactDOM from 'react-dom/client';

import './style.css';
import { App } from './app';
import { PopupProvider } from './contexts/popup-context';
import { ThemeProvider } from './contexts/theme-provider-context';
import { GlobalPopup } from './layout/global-popup';
import { Toaster } from './layout/sonner';

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

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import GlobalPopup from './components/layout/GlobalPopup';
import { PopupProvider } from './contexts/PopupContext';
import './style.css';
import { ThemeProvider } from './contexts/ThemeProviderContext';
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

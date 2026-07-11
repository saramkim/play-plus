import React from 'react';
import ReactDOM from 'react-dom/client';

import './style.css';
import { App } from './app';
import { Modal } from './components/modal';
import { ThemeProvider } from './contexts/theme-provider-context';
import { Toaster } from './layout/sonner';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <Modal />
      <Toaster />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

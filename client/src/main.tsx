import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initDeviceMode } from './utils/device';
import { PlatformProvider } from './context/PlatformContext';
import './index.css';

const profile = initDeviceMode();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PlatformProvider profile={profile}>
        <App />
      </PlatformProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

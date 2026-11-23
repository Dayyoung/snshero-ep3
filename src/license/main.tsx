import React from 'react';
import ReactDOM from 'react-dom/client';
import { LicenseApp } from './LicenseApp';
import './license.css';

const rootEl = document.getElementById('license-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <LicenseApp />
    </React.StrictMode>,
  );
}

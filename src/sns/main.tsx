import React from 'react';
import ReactDOM from 'react-dom/client';
import { SnsBenchmarkApp } from './SnsBenchmarkApp';
import './sns.css';

const rootEl = document.getElementById('sns-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <SnsBenchmarkApp />
    </React.StrictMode>,
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import '../hearthstone/hearthstone.css';
import './promo.css';
import { PromoApp } from './PromoApp';

const rootEl = document.getElementById('promo-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <PromoApp />
    </React.StrictMode>,
  );
}

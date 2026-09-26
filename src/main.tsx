import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SessionProvider } from './auth/SessionProvider';
import { StagingBanner } from './components/StagingBanner';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
        <StagingBanner />
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import PracticeApp from './components/PracticeApp.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import './index.css';
import 'katex/dist/katex.min.css';

// Lightweight path-based routing (the server serves index.html for any path):
//   /admin   -> question + model admin panel
//   /scanner -> original equation scanner
//   /        -> Myyra practice solver (default)
function Root() {
  const path = window.location.pathname;
  if (path.startsWith('/admin')) return <AdminPanel />;
  if (path.startsWith('/scanner')) return <App />;
  return <PracticeApp />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

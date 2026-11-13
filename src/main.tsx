import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SnackbarProvider } from 'notistack';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import App from './App.tsx';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        // SW 注册成功，浏览器将在满足 PWA 条件时自动提示安装应用
      })
      .catch(() => {
        // SW 注册失败不影响页面正常使用
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <App />
      </SnackbarProvider>
    </ErrorBoundary>
  </StrictMode>,
);

import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { ErrorFallback } from './ErrorBoundary';
export function RouteErrorBoundary() {
  const error = useRouteError();
  let message = '应用遇到了意外错误，就像笔尖突然断墨。';
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      message = '你访问的页面不存在，也许它去了远方。';
    } else {
      message = error.statusText || error.data || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }
  return (
    <ErrorFallback
      error={error instanceof Error ? error : new Error(message)}
      onReload={() => window.location.reload()}
    />
  );
}
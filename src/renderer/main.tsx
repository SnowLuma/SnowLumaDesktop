import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/globals.css';
import './i18n';
import { trpc, trpcClientConfig } from './lib/trpc';
import { App } from './App';

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => trpc.createClient(trpcClientConfig));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root element missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

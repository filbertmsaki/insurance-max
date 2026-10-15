import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import './index.css';
import App from './App';
import { ConnectionLostOverlay } from '@/modules/shared/connectivity/components/ConnectionLostOverlay';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

// Cached records belong to the session that fetched them: drop everything on
// logout or when a different user signs in on this tab.
useAuthStore.subscribe((state, previous) => {
  if ((state.user?.id ?? null) !== (previous.user?.id ?? null)) {
    queryClient.clear();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <ConnectionLostOverlay />
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);

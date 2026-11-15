import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";

import { ApiError } from "../lib/api";
import { I18nProvider } from "../lib/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        if (error instanceof ApiError && [401, 403, 404, 409, 422, 429].includes(error.status)) return false;
        return count < 1;
      },
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}

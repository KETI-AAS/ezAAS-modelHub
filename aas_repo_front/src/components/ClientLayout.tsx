/*
 * 파일명: src/components/ClientLayout.tsx
 * 설명: shadcn/ui 기반으로 재작성된 클라이언트 레이아웃.
 *       MantineProvider는 mantine-react-table 테이블 컴포넌트 호환성을 위해 유지.
 *       ModalsProvider 완전 제거 — 각 기능별 shadcn Dialog로 대체.
 */
"use client";

import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { showToast } from "@/utils/toast";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { MantineProvider } from "@mantine/core";

import Footer from "./Footer";
import Header from "./Header";
import { AuthProvider } from "../contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/constants/routes";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      gcTime: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.status === "error") {
        showToast.error(`오류가 발생했습니다 — ${error.message}`);
      }
    },
  }),
});

const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.RESET_PASSWORD];

export default function ClientLayout({
  tokenMessage,
  children,
}: {
  tokenMessage: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      {/* MantineProvider 유지 — mantine-react-table 내부 사용 */}
      <MantineProvider>
        <LanguageProvider>
          <AuthProvider tokenMessage={tokenMessage}>
            <div className="flex min-h-screen flex-col">
              {!isAuthPage && <Header />}
              <main className="flex-1">
                {children}
              </main>
              {!isAuthPage && <Footer />}
            </div>
          </AuthProvider>
        </LanguageProvider>
      </MantineProvider>
      <Toaster
        position="top-center"
        containerStyle={{ marginTop: "5rem" }}
        reverseOrder={false}
      />
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}

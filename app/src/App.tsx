import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { supabase } from "./lib/supabase";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthPage } from "./pages/AuthPage";
import { GroupsPage } from "./pages/GroupsPage";
import { GroupHomePage } from "./pages/GroupHomePage";
import { AddExpensePage } from "./pages/AddExpensePage";
import { ExpenseDetailPage } from "./pages/ExpenseDetailPage";
import { SettleUpPage } from "./pages/SettleUpPage";
import { MembersPage } from "./pages/MembersPage";
import type { Group } from "./lib/types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

const RootRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  const { data: groups, isLoading } = useQuery<Group[]>({
    queryKey: ["user-single-group", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  if (loading || (user && isLoading)) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-[var(--text-muted)] text-sm font-semibold">
        Loading your flat...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (groups && groups.length > 0) {
    return <Navigate to={`/group/${groups[0].id}`} replace />;
  }

  return <Navigate to="/setup" replace />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-[var(--text-muted)] text-sm font-semibold">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-[var(--text-muted)] text-sm font-semibold">
        Loading...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <AuthPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/setup"
                element={
                  <ProtectedRoute>
                    <GroupsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/groups"
                element={
                  <ProtectedRoute>
                    <GroupsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/group/:groupId"
                element={
                  <ProtectedRoute>
                    <GroupHomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/group/:groupId/add-expense"
                element={
                  <ProtectedRoute>
                    <AddExpensePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/group/:groupId/expense/:expenseId"
                element={
                  <ProtectedRoute>
                    <ExpenseDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/group/:groupId/settle"
                element={
                  <ProtectedRoute>
                    <SettleUpPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/group/:groupId/members"
                element={
                  <ProtectedRoute>
                    <MembersPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
}

export default App;

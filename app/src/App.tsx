import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { GroupsPage } from "./pages/GroupsPage";
import { GroupHomePage } from "./pages/GroupHomePage";
import { AddExpensePage } from "./pages/AddExpensePage";
import { ExpenseDetailPage } from "./pages/ExpenseDetailPage";
import { SettleUpPage } from "./pages/SettleUpPage";
import { MembersPage } from "./pages/MembersPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
        Loading...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/groups" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <AuthPage />
                </PublicOnlyRoute>
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
            <Route path="*" element={<Navigate to="/groups" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

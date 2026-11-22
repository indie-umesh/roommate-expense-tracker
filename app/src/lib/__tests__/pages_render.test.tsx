import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../../context/ThemeContext";
import { AuthProvider } from "../../context/AuthContext";
import { LanguageProvider } from "../../context/LanguageContext";
import { AuthPage } from "../../pages/AuthPage";
import { GroupsPage } from "../../pages/GroupsPage";
import { GroupHomePage } from "../../pages/GroupHomePage";

describe("Component SSR & Render Integrity", () => {
  const queryClient = new QueryClient();

  it("renders AuthPage without errors", () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <MemoryRouter>
                <AuthPage />
              </MemoryRouter>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
    expect(html).toContain("Roommate");
  });

  it("renders GroupsPage without errors", () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <MemoryRouter>
                <GroupsPage />
              </MemoryRouter>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
    expect(html).toContain("Roommate");
  });

  it("renders GroupHomePage without errors", () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <MemoryRouter initialEntries={["/group/6ba81de6-91e2-4f49-8a12-4524da7f9250"]}>
                <Routes>
                  <Route path="/group/:groupId" element={<GroupHomePage />} />
                </Routes>
              </MemoryRouter>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
    expect(html).toBeDefined();
  });
});

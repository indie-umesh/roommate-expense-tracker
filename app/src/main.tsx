import { StrictMode, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught render error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          backgroundColor: "#0b0f19",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center"
        }}>
          <div style={{
            maxWidth: "480px",
            backgroundColor: "#121826",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
          }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
              Something went wrong loading this screen
            </h2>
            <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "20px", wordBreak: "break-word" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/groups";
              }}
              style={{
                backgroundColor: "#10b981",
                color: "#022c22",
                fontWeight: "bold",
                padding: "12px 24px",
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Back to Groups
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
);

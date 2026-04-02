import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

const __DEV__ = import.meta.env.MODE === 'development';

// Global error handlers for unhandled async errors
window.addEventListener('unhandledrejection', (e) => {
  if (__DEV__) {
    console.error('Unhandled promise rejection:', e.reason);
  }
  // No e.preventDefault() — let the browser report the unhandled rejection
});

window.addEventListener('error', (e) => {
  if (__DEV__) {
    console.error('Uncaught error:', e.error);
  }
});

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    if (__DEV__) {
      console.error("App crash:", error, info);
    }
    // En producción: enviar a servicio de error tracking (Sentry, etc.)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.5rem' }}>Algo salió mal</h1>
          <p style={{ fontSize: '0.875rem', color: '#71717a', marginBottom: '2rem' }}>La app encontró un error inesperado</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }} style={{ background: '#f59e0b', color: 'black', fontWeight: 900, padding: '1rem 2rem', borderRadius: '1rem', border: 'none', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer' }}>
            Recargar App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

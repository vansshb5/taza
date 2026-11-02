import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AppProvider } from "./context/AppContext";
import AppShell from "./components/layout/AppShell";

import Dashboard from "./pages/Dashboard";
import InspectProduce from "./pages/InspectProduce";
import Batches from "./pages/Batches";
import BatchDetails from "./pages/BatchDetails";
import Traceability from "./pages/Traceability";
import Recommendations from "./pages/Recommendations";
import Agent from "./pages/Agent";
import Auth from "./pages/Auth";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>

          {/* =====================================================
              AUTHENTICATION (Standalone layout)
          ===================================================== */}
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth />} />

          {/* =====================================================
              MAIN APPLICATION
          ===================================================== */}
          <Route element={<AppShell />}>

            {/* AI Operations Dashboard */}
            <Route
              path="/"
              element={<Dashboard />}
            />

            {/* Main ML Analysis Page */}
            <Route
              path="/analyze"
              element={<InspectProduce />}
            />

            {/* Backward compatibility with old /inspect URL */}
            <Route
              path="/inspect"
              element={<Navigate to="/analyze" replace />}
            />

            {/* Produce Batches */}
            <Route
              path="/batches"
              element={<Batches />}
            />

            {/* Individual Batch */}
            <Route
              path="/batches/:id"
              element={<BatchDetails />}
            />

            {/* Recommendations */}
            <Route
              path="/recommendations"
              element={<Recommendations />}
            />

            {/* Supply Chain / Traceability */}
            <Route
              path="/traceability"
              element={<Traceability />}
            />

            {/* Optional AI explanation agent */}
            <Route
              path="/agent"
              element={<Agent />}
            />

          </Route>

          {/* =====================================================
              FALLBACK
          ===================================================== */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

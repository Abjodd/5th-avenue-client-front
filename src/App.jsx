/**
 * 5th Avenue — Client Portal App.jsx
 * Route table, same split as 5th-internal-front: /login is public, every
 * portal page sits behind ProtectedRoute inside the AppShell layout.
 * AuthProvider wraps the whole tree so useAuth() works everywhere.
 */
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LIGHT, AppContext } from "./context";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppShell from "./layout/AppShell";
import LoginPage from "./pages/Login";
import Overview from "./pages/Overview";
import Campaigns from "./pages/Campaigns";
import RegionalMap from "./pages/RegionalMap";

// Keeps the setPage(page, params) API the pages already use, but backed by
// the router: params travel as location.state so deep links survive refresh.
function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = location.pathname.replace(/^\//, "") || "overview";

  const setPage = (newPage, params = {}) => {
    navigate(`/${newPage}`, { state: params });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppContext.Provider value={{ page, setPage, navParams: location.state || {}, P: LIGHT }}>
      <AppShell>
        <Outlet />
      </AppShell>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><PortalLayout /></ProtectedRoute>}>
            <Route path="/overview"  element={<Overview />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/regional"  element={<RegionalMap />} />
            <Route path="/"          element={<Navigate to="/overview" replace />} />
            <Route path="*"          element={<Navigate to="/overview" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

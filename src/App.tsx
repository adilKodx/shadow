import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import AlertsPage from './pages/Alerts';
import IncidentsPage from './pages/Incidents';
import POI from './pages/POI';
import NewsPage from './pages/News';
import VideoFeedsPage from './pages/VideoFeeds';
import TeamPage from './pages/Team';
import BrandingPage from './pages/Branding';
import SettingsPage from './pages/Settings';
import LiveMap from './pages/LiveMap';
import PinLockGate from './components/PinLockGate';
import TermsGate from './components/TermsGate';
import PartnerSignup from './pages/PartnerSignup';
import WhiteLabelAdmin from './pages/WhiteLabelAdmin';
import PartnerPortal from './pages/PartnerPortal';
import SOPsPage from './pages/SOPs';
import AttendancePage from './pages/Attendance';
import ChangelogPage from './pages/Changelog';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BrandingProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/signup/:slug" element={<PartnerSignup />} />

            {/* Protected routes with layout */}
            <Route element={<ProtectedRoute><TermsGate><PinLockGate><Layout /></PinLockGate></TermsGate></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/poi" element={<POI />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/video-feeds" element={<VideoFeedsPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/branding" element={<BrandingPage />} />
              <Route path="/white-label" element={<WhiteLabelAdmin />} />
              <Route path="/partner" element={<PartnerPortal />} />
              <Route path="/sops" element={<SOPsPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/map" element={<LiveMap />} />
            </Route>

            {/* Default redirect — role-aware */}
            <Route path="*" element={<DefaultLanding />} />
          </Routes>
        </BrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

/**
 * Role-aware landing page used for the `*` wildcard route and any time the
 * app needs to pick a sensible default destination.
 *
 *   - signed-out  → /login
 *   - has tenant  → /dashboard
 *   - partner-only (no tenant, has partner_users grant) → /partner
 *   - platform admin without tenant → /white-label
 *   - fallback    → /login
 */
function DefaultLanding() {
  const { user, loading, tenant, partnerMembership, isPlatformAdmin } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (tenant) return <Navigate to="/dashboard" replace />;
  if (partnerMembership) return <Navigate to="/partner" replace />;
  if (isPlatformAdmin) return <Navigate to="/white-label" replace />;
  return <Navigate to="/login" replace />;
}

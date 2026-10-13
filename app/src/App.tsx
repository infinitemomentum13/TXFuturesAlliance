import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from '@/hooks/useTheme';
import { getSession, onAuthChange } from '@/api/auth';
import type { Session } from '@/api/types';
import { AppShell } from '@/components/layout/AppShell';
import Login from '@/pages/Login';
import ParentSignup from '@/pages/ParentSignup';
import Onboarding from '@/pages/Onboarding';
import Home from '@/pages/Home';
import ConsentCenter from '@/pages/ConsentCenter';
import Privacy from '@/pages/Privacy';
import Admin from '@/pages/Admin';
import Compass from '@/pages/Compass';
import CompassResults from '@/pages/CompassResults';
import Profile from '@/pages/Profile';
import CareerPage from '@/pages/Career';
import CollegePage from '@/pages/College';
import CareerDetail from '@/pages/CareerDetail';
import SportsPage from '@/pages/Sports';
import TalentPage from '@/pages/Talent';
import StaffPage from '@/pages/Staff';
import ParentPage from '@/pages/Parent';
import PartnerPage from '@/pages/Partner';

/** Protected route: redirects to sign-in and comes back afterwards. */
function Protected({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const location = useLocation();

  useEffect(() => {
    setSession(getSession());
    return onAuthChange(setSession);
  }, []);

  if (session === undefined) return null;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup-parent" element={<ParentSignup />} />
          <Route path="/privacy" element={<Protected><Privacy /></Protected>} />
          <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
          <Route path="/" element={<Protected><Home /></Protected>} />
          <Route path="/career" element={<Protected><CareerPage /></Protected>} />
          <Route path="/career/:careerId" element={<Protected><CareerDetail /></Protected>} />
          <Route path="/college" element={<Protected><CollegePage /></Protected>} />
          <Route path="/sports" element={<Protected><SportsPage /></Protected>} />
          <Route path="/staff" element={<Protected><StaffPage /></Protected>} />
          <Route path="/talent" element={<Protected><TalentPage /></Protected>} />
          <Route path="/parent" element={<Protected><ParentPage /></Protected>} />
          <Route path="/partner" element={<Protected><PartnerPage /></Protected>} />
          <Route path="/consent" element={<Protected><ConsentCenter /></Protected>} />
          <Route path="/compass" element={<Protected><Compass /></Protected>} />
          <Route path="/compass/results" element={<Protected><CompassResults /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/admin" element={<Protected><Admin /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </I18nProvider>
    </ThemeProvider>
  );
}

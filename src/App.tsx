import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
import AdminPage from '@/pages/AdminPage';
import VeranstalterPage from '@/pages/VeranstalterPage';
import VeranstalterDetailPage from '@/pages/VeranstalterDetailPage';
import VeranstaltungenPage from '@/pages/VeranstaltungenPage';
import VeranstaltungenDetailPage from '@/pages/VeranstaltungenDetailPage';
import AnmeldungenPage from '@/pages/AnmeldungenPage';
import AnmeldungenDetailPage from '@/pages/AnmeldungenDetailPage';
import PublicFormVeranstalter from '@/pages/public/PublicForm_Veranstalter';
import PublicFormVeranstaltungen from '@/pages/public/PublicForm_Veranstaltungen';
import PublicFormAnmeldungen from '@/pages/public/PublicForm_Anmeldungen';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a315b1e3b0ba0a7a2d28905" element={<PublicFormVeranstalter />} />
              <Route path="public/6a315b225049324bae74cc15" element={<PublicFormVeranstaltungen />} />
              <Route path="public/6a315b23fe1f8743a7f9aaff" element={<PublicFormAnmeldungen />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
                <Route path="veranstalter" element={<VeranstalterPage />} />
                <Route path="veranstalter/:id" element={<VeranstalterDetailPage />} />
                <Route path="veranstaltungen" element={<VeranstaltungenPage />} />
                <Route path="veranstaltungen/:id" element={<VeranstaltungenDetailPage />} />
                <Route path="anmeldungen" element={<AnmeldungenPage />} />
                <Route path="anmeldungen/:id" element={<AnmeldungenDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}

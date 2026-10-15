import { useEffect, useState } from 'react';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ExamsDashboard } from './pages/ExamsDashboard/ExamsDashboard';
import { AppShell } from './components/AppShell/AppShell';
import type { AppPage } from './components/AppShell/AppShell';
import type { PublicConfig } from './types';
import { getPublicConfig } from './services/config';
import { getApiError } from './services/api';

export default function App() {
  const [page, setPage] = useState<AppPage>('exams');
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [configRevision, setConfigRevision] = useState(0);
  const [examsBusy, setExamsBusy] = useState(false);
  const [patientsBusy, setPatientsBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setConfigError('');
    void getPublicConfig(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setConfig(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setConfigError(getApiError(cause, 'Não foi possível consultar o modo de e-mail.'));
      });
    return () => controller.abort();
  }, [configRevision]);

  return (
    <AppShell
      page={page}
      onNavigate={setPage}
      disabled={examsBusy || patientsBusy}
      emailProvider={config?.emailProvider ?? null}
      configError={configError}
      onReloadConfig={() => setConfigRevision((value) => value + 1)}
    >
      <div hidden={page !== 'exams'}>
        <ExamsDashboard onBusyChange={setExamsBusy} />
      </div>
      <div hidden={page !== 'patients'}>
        <Dashboard emailProvider={config?.emailProvider ?? null} onBusyChange={setPatientsBusy} />
      </div>
    </AppShell>
  );
}

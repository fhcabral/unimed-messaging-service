import { useEffect, useRef, useState } from 'react';
import type { Exam, ExamStatus, NotificationStatus, PaginatedResponse } from '../../types';
import { listExams, processPendingExams, retryFailedExam } from '../../services/exams';
import { getApiError } from '../../services/api';
import { ExamTable } from '../../components/ExamTable/ExamTable';
import { notificationLabels } from '../../components/ExamStatusBadge/ExamStatusBadge';
import { Dialog } from '../../components/Dialog/Dialog';
import { Feedback } from '../../components/Feedback/Feedback';
import { Icon } from '../../components/Icon/Icon';
import styles from './ExamsDashboard.module.css';

export function ExamsDashboard({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const [response, setResponse] = useState<PaginatedResponse<Exam> | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState<ExamStatus | ''>('');
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus | ''>('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryTarget, setRetryTarget] = useState<Exam | null>(null);
  const locked = useRef(false);

  useEffect(() => {
    onBusyChange(busy || !!retryTarget);
  }, [busy, retryTarget, onBusyChange]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listExams({ page, limit, status: status || undefined, notificationStatus: notificationStatus || undefined }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(data.total / limit));
        if (page > lastPage) setPage(lastPage);
        else setResponse(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(getApiError(cause, 'Não foi possível carregar os exames.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, limit, status, notificationStatus, revision]);

  async function process(retry?: Exam) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = retry ? await retryFailedExam(retry.id) : await processPendingExams();
      setNotice(`${result.total} processado(s): ${result.sent} notificado(s), ${result.failed} falha(s), ${result.uncertain} resultado(s) incerto(s).`);
      setRetryTarget(null);
    } catch (cause) {
      setActionError(getApiError(cause, 'Não foi possível confirmar o processamento. Consulte a lista antes de tentar novamente.'));
    } finally {
      locked.current = false;
      setBusy(false);
      setRevision((current) => current + 1);
    }
  }

  const total = response?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <section className={styles.page} aria-labelledby="exams-title">
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>RESULTADOS E NOTIFICAÇÕES</span><h1 id="exams-title">Exames</h1><p>Acompanhe a liberação de resultados e o envio automático de SMS.</p></div>
        <div className={styles.actions}>
          <button type="button" className="button button-secondary" onClick={() => setRevision((value) => value + 1)} disabled={loading || busy}><Icon name="refresh" size={16} />Atualizar</button>
          <button type="button" className="button button-primary" onClick={() => { void process(); }} disabled={busy}><Icon name="send" size={16} />{busy ? 'Processando…' : 'Processar pendentes'}</button>
        </div>
      </header>
      <div className={styles.explanation}><Feedback>Exames liberados são notificados automaticamente na inicialização do backend, mesmo sem abrir esta página. “Processar pendentes” faz uma nova verificação. SMS é simulado; falhas exigem reprocessamento explícito.</Feedback></div>
      <div aria-live="polite" className={styles.messages}>
        {notice && <Feedback>{notice}</Feedback>}
        {actionError && !retryTarget && <Feedback tone="error">{actionError}</Feedback>}
      </div>
      <div className={styles.card}>
        <div className={styles.filters}>
          <label>Status do exame<select className="field-input" value={status} disabled={busy} onChange={(event) => { setStatus(event.target.value as ExamStatus | ''); setPage(1); }}><option value="">Todos</option><option value="PENDING">Pendente</option><option value="RELEASED">Liberado</option></select></label>
          <label>Notificação<select className="field-input" value={notificationStatus} disabled={busy} onChange={(event) => { setNotificationStatus(event.target.value as NotificationStatus | ''); setPage(1); }}><option value="">Todas</option>{Object.entries(notificationLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <span className={styles.total}>{total} exame(s)</span>
        </div>
        {error ? <div className={styles.error}><Feedback tone="error">{error}</Feedback><button type="button" className="button button-secondary" onClick={() => setRevision((value) => value + 1)} disabled={busy || loading}>Tentar novamente</button></div> : <ExamTable exams={response?.data ?? []} loading={loading} busy={busy} onRetry={(exam) => { setActionError(''); setRetryTarget(exam); }} />}
        <footer className={styles.pagination}>
          <label>Por página <select value={limit} disabled={loading || busy} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
          <div><span>Página {page} de {pages}</span><button type="button" className="icon-button" aria-label="Página anterior" disabled={loading || busy || !!error || page <= 1} onClick={() => setPage((value) => value - 1)}><Icon name="chevron-left" size={16} /></button><button type="button" className="icon-button" aria-label="Próxima página" disabled={loading || busy || !!error || page >= pages} onClick={() => setPage((value) => value + 1)}><Icon name="chevron-right" size={16} /></button></div>
        </footer>
      </div>
      <p className={styles.footnote}>PROCESSING prolongado exige conferência do histórico antes de reenvio. O aceite do mock não comprova entrega ao celular.</p>
      {retryTarget && <Dialog title="Reprocessar notificação com falha?" description="Uma nova tentativa será registrada, preservando o erro anterior." busy={busy} onClose={() => setRetryTarget(null)}>
        <div className={styles.confirm}><p>Confirmar nova tentativa de SMS simulado para <strong>{retryTarget.patient.name}</strong>?</p><Feedback>Somente falhas confirmadas podem ser reprocessadas. Exames já notificados ou ainda em processamento são bloqueados pela API.</Feedback>{actionError && <Feedback tone="error">{actionError}</Feedback>}</div>
        <footer className={styles.confirmActions}><button type="button" className="button button-secondary" data-initial-focus="true" disabled={busy} onClick={() => setRetryTarget(null)}>Cancelar</button><button type="button" className="button button-primary" disabled={busy} onClick={() => { void process(retryTarget); }}>{busy ? 'Processando…' : 'Confirmar reprocessamento'}</button></footer>
      </Dialog>}
    </section>
  );
}

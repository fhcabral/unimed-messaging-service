import type { Exam } from '../../types';
import { ExamStatusBadge } from '../ExamStatusBadge/ExamStatusBadge';
import styles from './ExamTable.module.css';

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

export function ExamTable({ exams, loading, busy, onRetry }: { exams: Exam[]; loading: boolean; busy: boolean; onRetry: (exam: Exam) => void }) {
  return (
    <div className={styles.wrapper} aria-busy={loading}>
      <table className={styles.table}>
        <caption className="sr-only">Exames e histórico da última tentativa de notificação por SMS</caption>
        <thead><tr>
          <th scope="col">Paciente / exame</th><th scope="col">Exame</th><th scope="col">Liberação</th><th scope="col">Notificação</th><th scope="col">Envio</th><th scope="col">Detalhes / ações</th>
        </tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={6} className={styles.state}><span className="spinner spinner-dark" /> Carregando exames…</td></tr>
            : !exams.length ? <tr><td colSpan={6} className={styles.state}>Nenhum exame encontrado para os filtros atuais.</td></tr>
              : exams.map((exam) => <tr key={exam.id}>
                <td><strong className={styles.name}>{exam.patient.name}</strong><small className={styles.id}>{exam.id}</small></td>
                <td>{exam.status === 'RELEASED' ? 'Liberado' : 'Pendente'}</td>
                <td className={styles.date}>{formatDate(exam.releasedAt)}</td>
                <td><ExamStatusBadge status={exam.notificationStatus} /></td>
                <td className={styles.date}>{formatDate(exam.notifiedAt)}</td>
                <td className={styles.details}>
                  {exam.notificationError && <p>{exam.notificationError}</p>}
                  {exam.notificationStatus === 'PROCESSING' && <p className={exam.reconciliationRequired ? styles.warning : undefined}>
                    {exam.reconciliationRequired ? 'Processamento prolongado: conferir histórico e resultado antes de qualquer reenvio.' : 'Envio em andamento. Atualize a lista para consultar o resultado.'}
                    {exam.processingStartedAt && <small>Início: {formatDate(exam.processingStartedAt)}</small>}
                  </p>}
                  {exam.notificationStatus === 'FAILED' && <button type="button" className="text-button" disabled={busy} onClick={() => onRetry(exam)}>Reprocessar falha</button>}
                  {!exam.notificationError && exam.notificationStatus !== 'PROCESSING' && exam.notificationStatus !== 'FAILED' && '—'}
                </td>
              </tr>)}
        </tbody>
      </table>
    </div>
  );
}

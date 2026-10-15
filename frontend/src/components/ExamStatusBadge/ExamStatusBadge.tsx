import type { NotificationStatus } from '../../types';
import styles from './ExamStatusBadge.module.css';

export const notificationLabels: Record<NotificationStatus, string> = {
  NOT_ELIGIBLE: 'Aguardando liberação',
  PENDING: 'Aguardando notificação',
  PROCESSING: 'Processando',
  SENT: 'Notificado',
  FAILED: 'Falha',
};

export function ExamStatusBadge({ status }: { status: NotificationStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span aria-hidden="true" />
      {notificationLabels[status]}
    </span>
  );
}

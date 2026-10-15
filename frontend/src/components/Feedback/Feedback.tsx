import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './Feedback.module.css';

export function Feedback({
  tone = 'info',
  children,
  title,
}: {
  tone?: 'info' | 'success' | 'error' | 'warning';
  children: ReactNode;
  title?: string;
}) {
  return (
    <div
      className={`${styles.feedback} ${styles[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon
        name={
          tone === 'success'
            ? 'check-circle'
            : tone === 'warning' || tone === 'error'
              ? 'alert'
              : 'info'
        }
        size={19}
      />
      <div>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

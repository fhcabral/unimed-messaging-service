import type { CSSProperties, ReactNode } from 'react';
import styles from './Icon.module.css';

type IconName =
  | 'cross'
  | 'patients'
  | 'message'
  | 'upload'
  | 'search'
  | 'plus'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'check'
  | 'close'
  | 'info'
  | 'file'
  | 'send'
  | 'external'
  | 'arrow-right'
  | 'refresh'
  | 'alert'
  | 'check-circle';

const paths: Record<IconName, ReactNode> = {
  cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" />,
  patients: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  message: (
    <path
      d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 3v-10A8.5 8.5 0 0 1 9.5 4H21Zm-14-.5h8m-8 4h5"
      transform="translate(1 -1) scale(.92)"
    />
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h5" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Zm0 0L11 13" />
    </>
  ),
  external: (
    <>
      <path d="M15 3h6v6m0-6L10 14M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
    </>
  ),
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  refresh: (
    <>
      <path d="M20 8a8 8 0 1 0 0 9m0-14v5h-5" />
    </>
  ),
  alert: (
    <>
      <path d="m10.3 3-8.5 15A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-3l-8.5-15a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4m0 4h.01" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`${styles.icon} ${className}`}
      style={{ '--icon-size': `${size}px` } as CSSProperties}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

import type { ReactNode } from 'react';
import type { EmailProviderMode } from '../../types';
import { API_URL } from '../../services/api';
import { Icon } from '../Icon/Icon';
import styles from './AppShell.module.css';

export type AppPage = 'exams' | 'patients';

export function AppShell({
  page,
  onNavigate,
  disabled,
  emailProvider,
  configError,
  onReloadConfig,
  children,
}: {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  disabled: boolean;
  emailProvider: EmailProviderMode | null;
  configError: string;
  onReloadConfig: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Icon name="cross" size={25} />
          </span>
          <div>
            <strong>
              Hospitalar<span>.</span>
            </strong>
            <small>PLATAFORMA DE MENSAGERIA</small>
          </div>
        </div>
        <span className={styles.navLabel}>ÁREA DE TRABALHO</span>
        <nav aria-label="Navegação principal" className={styles.navigation}>
          {(
            [
              { id: 'exams', label: 'Exames', icon: 'file' },
              { id: 'patients', label: 'Pacientes e Mensagens', icon: 'patients' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? styles.active : ''}
              aria-current={page === item.id ? 'page' : undefined}
              disabled={disabled}
              onClick={() => onNavigate(item.id)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className={styles.guide}>
          <Icon name="message" size={25} />
          <h2>
            O cuidado continua
            <br />
            depois do atendimento.
          </h2>
          <p>Acompanhe exames e mantenha a comunicação próxima de cada paciente.</p>
        </div>
        <small className={styles.demo}>DEMONSTRAÇÃO LOCAL · v0.2</small>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <span className={styles.breadcrumb}>
            Comunicação <Icon name="chevron-right" size={13} />
            <strong>{page === 'exams' ? 'Exames' : 'Pacientes e Mensagens'}</strong>
          </span>
          <span className={styles.badge}>
            SMS simulado ·{' '}
            {emailProvider === 'MOCK'
              ? 'E-mail simulado'
              : emailProvider === 'SMTP'
                ? 'E-mail real via SMTP'
                : 'Consultando e-mail…'}
          </span>
        </header>
        {configError && (
          <div className={styles.configError} role="alert">
            {configError}{' '}
            <button type="button" className="text-button" onClick={onReloadConfig}>
              Consultar configuração
            </button>
          </div>
        )}
        <main id="conteudo">{children}</main>
        <footer className={styles.footer}>
          <span>Demonstração com dados fictícios.</span>
          <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer">
            Documentação da API <Icon name="external" size={12} />
          </a>
        </footer>
      </div>
    </div>
  );
}

import { useId } from 'react';
import type { EmailProviderMode, MessageChannel, MessageTemplate, Patient } from '../../types';
import { DEFAULT_EMAIL_SUBJECT } from '../../services/templates';
import { Icon } from '../Icon/Icon';
import { Feedback } from '../Feedback/Feedback';
import styles from './TemplateSelect.module.css';

interface Props {
  emailProvider: EmailProviderMode | null;
  templates: MessageTemplate[];
  selectedId: string;
  samplePatient?: Patient;
  loading: boolean;
  error: string;
  disabled: boolean;
  channels: MessageChannel[];
  onChannelToggle: (channel: MessageChannel) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRetry: () => void;
}

export function TemplateSelect({
  emailProvider,
  templates,
  selectedId,
  samplePatient,
  loading,
  error,
  disabled,
  channels,
  onChannelToggle,
  onSelect,
  onCreate,
  onRetry,
}: Props) {
  const selectId = useId();
  const emailLabel =
    emailProvider === 'MOCK'
      ? 'Simulado'
      : emailProvider === 'SMTP'
        ? 'Real via SMTP'
        : 'Configuração indisponível';
  const selected = templates.find((template) => template.id === selectedId);
  const preview = selected?.content.replaceAll('{{name}}', () => samplePatient?.name ?? '{{name}}');

  return (
    <section className={styles.card} aria-labelledby="template-title">
      <div className={styles.heading}>
        <span className={styles.sectionIcon}>
          <Icon name="message" size={19} />
        </span>
        <div>
          <h2 id="template-title">Prepare a mensagem</h2>
          <p>Um cuidado a mais, em poucas palavras.</p>
        </div>
      </div>
      <div className={styles.body}>
        <label className="field-label" htmlFor={selectId}>
          Template de mensagem
        </label>
        <div className={styles.selectRow}>
          <div className={styles.selectWrap}>
            <select
              id={selectId}
              className="field-input"
              value={selectedId}
              onChange={(event) => onSelect(event.target.value)}
              disabled={disabled || loading || !templates.length}
              aria-busy={loading}
            >
              <option value="">
                {loading
                  ? 'Carregando templates…'
                  : templates.length
                    ? 'Selecione um template'
                    : 'Nenhum template cadastrado'}
              </option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" size={15} />
          </div>
          <button
            className={styles.createButton}
            type="button"
            aria-label="Criar novo template"
            title="Criar novo template"
            disabled={disabled || loading}
            onClick={onCreate}
          >
            <Icon name="plus" size={19} />
          </button>
        </div>
        {error && (
          <div className={styles.error}>
            <Feedback tone="error">{error}</Feedback>
            <button
              className="text-button"
              type="button"
              onClick={onRetry}
              disabled={disabled || loading}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {!loading && !error && !templates.length && (
          <p className={styles.emptyHint}>
            Crie seu primeiro template no botão <strong>+</strong> ao lado.
          </p>
        )}
        <fieldset className={styles.channels} disabled={disabled}>
          <legend>Canais de envio</legend>
          <div className={styles.channelOptions}>
            <label>
              <input
                type="checkbox"
                checked={channels.includes('SMS')}
                onChange={() => onChannelToggle('SMS')}
              />
              <span>
                <strong>SMS</strong>
                <small>Simulado</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={channels.includes('EMAIL')}
                disabled={!emailProvider}
                onChange={() => onChannelToggle('EMAIL')}
              />
              <span>
                <strong>E-mail</strong>
                <small>{emailLabel}</small>
              </span>
            </label>
          </div>
          {!channels.length && <p role="status">Selecione pelo menos um canal.</p>}
        </fieldset>
        {channels.includes('EMAIL') && (
          <div className={styles.emailWarning}>
            <Icon name="info" size={15} />
            <p>
              {emailProvider === 'MOCK'
                ? 'E-mail simulado, sem conexão externa.'
                : emailProvider === 'SMTP'
                  ? 'E-mail real via SMTP, enviado após sua confirmação.'
                  : 'Aguarde a confirmação do modo de e-mail pela API.'}
            </p>
          </div>
        )}
        <div className={styles.previewHeader}>
          <span>
            <Icon name="message" size={13} /> PRÉ-VISUALIZAÇÃO
          </span>
          <span>
            {channels.length
              ? channels.map((channel) => (channel === 'SMS' ? 'SMS' : 'E-mail')).join(' + ')
              : 'Sem canal'}
          </span>
        </div>
        <div className={styles.preview} aria-live="polite">
          {selected ? (
            <>
              <div className={styles.conversationLabel}>
                <span className={styles.conversationDot} />
                Mensagem de acompanhamento
              </div>
              {channels.includes('EMAIL') && (
                <div className={styles.subject}>
                  <span>Assunto do e-mail</span>
                  <strong>{selected.subject?.trim() || DEFAULT_EMAIL_SUBJECT}</strong>
                </div>
              )}
              <div className={styles.bubble}>{preview}</div>
              <span className={styles.characterCount}>
                {preview?.length.toLocaleString('pt-BR')} caracteres
              </span>
            </>
          ) : (
            <div className={styles.emptyPreview}>
              <Icon name="message" size={28} />
              <p>Sua mensagem aparece aqui</p>
              <span>Escolha um template para visualizar o conteúdo antes do envio.</span>
            </div>
          )}
        </div>
        {selected && samplePatient && (
          <p className={styles.personalized}>
            Prévia personalizada com o primeiro paciente selecionado.
          </p>
        )}
        <div className={styles.variable}>
          <Icon name="info" size={16} />
          <p>
            Use <code>{'{{name}}'}</code> para incluir automaticamente o nome de cada paciente.
          </p>
        </div>
      </div>
      <footer className={styles.footer}>
        <span className={styles.dot} />
        <p>
          <strong>SMS simulado · E-mail: {emailLabel}</strong>O modo de e-mail é informado pela API.
          Revise os destinatários antes de confirmar o envio.
        </p>
      </footer>
    </section>
  );
}

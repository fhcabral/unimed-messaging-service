import { useId } from 'react';
import type { MessageTemplate, Patient } from '../../types';
import { Icon } from '../Icon/Icon';
import { Feedback } from '../Feedback/Feedback';
import styles from './TemplateSelect.module.css';

interface Props {
  templates: MessageTemplate[];
  selectedId: string;
  samplePatient?: Patient;
  loading: boolean;
  error: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRetry: () => void;
}

export function TemplateSelect({
  templates,
  selectedId,
  samplePatient,
  loading,
  error,
  disabled,
  onSelect,
  onCreate,
  onRetry,
}: Props) {
  const selectId = useId();
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
        <div className={styles.previewHeader}>
          <span>
            <Icon name="message" size={13} /> PRÉ-VISUALIZAÇÃO
          </span>
          <span>SMS</span>
        </div>
        <div className={styles.preview} aria-live="polite">
          {selected ? (
            <>
              <div className={styles.conversationLabel}>
                <span className={styles.conversationDot} />
                Mensagem de acompanhamento
              </div>
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
          <strong>Ambiente de demonstração</strong>O envio é simulado. Nenhum SMS real será enviado.
        </p>
      </footer>
    </section>
  );
}

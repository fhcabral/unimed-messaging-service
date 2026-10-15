import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { MessageTemplate } from '../../types';
import { createTemplate } from '../../services/templates';
import { getApiError } from '../../services/api';
import { Dialog } from '../Dialog/Dialog';
import { Feedback } from '../Feedback/Feedback';
import { Icon } from '../Icon/Icon';
import styles from './TemplateModal.module.css';

export function TemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (template: MessageTemplate) => void;
}) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<{ name?: string; content?: string }>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const fields: typeof errors = {};
    if (!name.trim()) fields.name = 'Informe o título do template.';
    else if (name.trim().length > 120 || name.includes('\0'))
      fields.name = 'Use até 120 caracteres válidos.';
    if (!content.trim()) fields.content = 'Escreva o conteúdo da mensagem.';
    else if (content.trim().length > 1600 || content.includes('\0'))
      fields.content = 'Use até 1.600 caracteres válidos.';
    else if (!/^(?:[^{}]|\{\{name\}\})*$/.test(content.trim()))
      fields.content =
        'A única variável permitida é {{name}}, escrita exatamente assim. Revise as chaves da mensagem.';
    setErrors(fields);
    setError('');
    if (Object.keys(fields).length) {
      document.getElementById(fields.name ? 'template-name' : 'template-content')?.focus();
      return;
    }
    locked.current = true;
    setSaving(true);
    try {
      const created = await createTemplate({ name: name.trim(), content: content.trim() });
      onCreated(created);
    } catch (cause) {
      setError(
        getApiError(
          cause,
          'Não foi possível salvar o template. Consulte a lista antes de tentar novamente.',
        ),
      );
      locked.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      title="Novo template"
      description="Prepare uma mensagem para reutilizar nos seus envios."
      busy={saving}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
      >
        <div className={styles.fields}>
          <div>
            <label className="field-label" htmlFor="template-name">
              Título do template <span aria-hidden="true">*</span>
            </label>
            <input
              id="template-name"
              className="field-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Acompanhamento pós-exame"
              maxLength={120}
              required
              data-initial-focus="true"
              disabled={saving}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'template-name-error' : undefined}
            />
            {errors.name && (
              <p className="field-error" id="template-name-error">
                {errors.name}
              </p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="template-content">
              Conteúdo da mensagem <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="template-content"
              className="field-input"
              rows={6}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Escreva sua mensagem e use {{name}} para personalizar."
              maxLength={1600}
              required
              disabled={saving}
              aria-invalid={!!errors.content}
              aria-describedby={`template-content-help${errors.content ? ' template-content-error' : ''}`}
            />
            <div className={styles.contentMeta}>
              <span id="template-content-help">
                Somente a variável <code>{'{{name}}'}</code> é aceita.
              </span>
              <span>{content.length.toLocaleString('pt-BR')} / 1.600</span>
            </div>
            {errors.content && (
              <p className="field-error" id="template-content-error">
                {errors.content}
              </p>
            )}
          </div>
          <div className={styles.tip}>
            <Icon name="info" size={17} />
            <p>
              O nome de cada paciente substitui <code>{'{{name}}'}</code> no momento do envio. A
              mensagem pode ter o mesmo texto para todos ou ser personalizada com essa variável.
            </p>
          </div>
          {error && <Feedback tone="error">{error}</Feedback>}
        </div>
        <footer className={styles.footer}>
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? <span className="spinner" /> : <Icon name="check" size={17} />}
            {saving ? 'Salvando…' : 'Salvar template'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

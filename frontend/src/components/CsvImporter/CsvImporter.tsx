import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { importPatients, MAX_CSV_BYTES } from '../../services/patients';
import { getApiError } from '../../services/api';
import { Icon } from '../Icon/Icon';
import { Feedback } from '../Feedback/Feedback';
import type { ImportResult } from '../../types';
import styles from './CsvImporter.module.css';

export function CsvImporter({
  disabled = false,
  onImported,
}: {
  disabled?: boolean;
  onImported: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || inFlight.current || disabled) return;
    setError('');
    setResult(null);
    if (!/\.csv$/i.test(file.name)) {
      setError('Selecione um arquivo com extensão .csv.');
      return;
    }
    if (file.size === 0) {
      setError(
        'O arquivo está vazio. Inclua name e ao menos uma coluna de contato: phone ou email.',
      );
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setError('O arquivo deve ter no máximo 1 MiB.');
      return;
    }
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await importPatients(file);
      setResult(response);
      onImported();
    } catch (cause) {
      setError(
        getApiError(
          cause,
          'Não foi possível concluir a importação. Atualize a lista antes de tentar novamente.',
        ),
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <div className={styles.importer}>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept=".csv,text/csv"
        aria-label="Selecionar CSV de pacientes"
        tabIndex={-1}
        disabled={disabled || loading}
        onChange={(event) => {
          void handleFile(event);
        }}
      />
      <button
        className="button button-primary"
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || loading}
        aria-busy={loading}
      >
        {loading ? <span className="spinner" /> : <Icon name="upload" size={18} />}
        {loading ? 'Importando pacientes…' : 'Importar pacientes'}
      </button>
      <span className={styles.hint}>CSV · até 1 MiB · 1.000 registros</span>
      <span className={styles.hint}>Colunas: name,phone,email · CSV antigo também é aceito</span>
      {error && <Feedback tone="error">{error}</Feedback>}
      {result && (
        <Feedback tone={result.invalid ? 'warning' : 'success'} title="Importação concluída">
          {result.imported} importados · {result.ignored} ignorados · {result.invalid} inválidos.
          {result.ignored > 0 && (
            <span className={styles.detail}>Telefones ou e-mails duplicados foram ignorados.</span>
          )}
        </Feedback>
      )}
    </div>
  );
}

import { useEffect, useId, useRef } from 'react';
import type { Patient, PaginatedResponse } from '../../types';
import { MAX_SEND_PATIENTS } from '../../services/messages';
import { Feedback } from '../Feedback/Feedback';
import { Icon } from '../Icon/Icon';
import styles from './PatientTable.module.css';

interface Props {
  response: PaginatedResponse<Patient> | null;
  loading: boolean;
  error: string;
  search: string;
  page: number;
  limit: number;
  selectedIds: ReadonlySet<string>;
  disabled: boolean;
  selectionError: string;
  onSearch: (value: string) => void;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
  onToggle: (patients: Patient[], select: boolean) => void;
  onClear: () => void;
  onRetry: () => void;
}

function formatPhone(phone: string) {
  return phone.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, '+55 ($1) $2-$3');
}

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toLocaleUpperCase(
    'pt-BR',
  );
}

export function PatientTable({
  response,
  loading,
  error,
  search,
  page,
  limit,
  selectedIds,
  disabled,
  selectionError,
  onSearch,
  onPage,
  onLimit,
  onToggle,
  onClear,
  onRetry,
}: Props) {
  const selectAll = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const rows = response?.data ?? [];
  const total = response?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const selectedOnPage = rows.filter((patient) => selectedIds.has(patient.id)).length;
  const allSelected = rows.length > 0 && selectedOnPage === rows.length;
  const cannotSelectPage =
    !allSelected && selectedIds.size + rows.length - selectedOnPage > MAX_SEND_PATIENTS;

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selectedOnPage > 0 && !allSelected;
  }, [selectedOnPage, allSelected]);

  return (
    <section className={styles.card} aria-labelledby="patients-title">
      <div className={styles.heading}>
        <div className={styles.title}>
          <span className={styles.sectionIcon}>
            <Icon name="patients" size={19} />
          </span>
          <div>
            <h2 id="patients-title">Pacientes</h2>
            <p>Selecione quem vai receber a mensagem.</p>
          </div>
        </div>
        <span className={styles.count} aria-label={`${total} pacientes cadastrados`}>
          {loading && !response ? '—' : total.toLocaleString('pt-BR')} cadastrados
        </span>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Icon name="search" size={18} />
          <label htmlFor={searchId} className="sr-only">
            Buscar paciente por nome ou telefone
          </label>
          <input
            id={searchId}
            type="search"
            placeholder="Buscar por nome ou telefone…"
            value={search}
            maxLength={160}
            disabled={disabled}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Atualizar lista de pacientes"
          title="Atualizar lista"
          onClick={onRetry}
          disabled={disabled || loading}
        >
          <Icon name="refresh" size={18} />
        </button>
      </div>
      <div className={styles.selection}>
        <span>
          <strong>{selectedIds.size}</strong> selecionados{' '}
          <span className={styles.selectionHint}>de até {MAX_SEND_PATIENTS} por envio</span>
        </span>
        {selectedIds.size > 0 && (
          <button type="button" className="text-button" onClick={onClear} disabled={disabled}>
            Limpar seleção
          </button>
        )}
      </div>
      {selectionError && (
        <div className={styles.notice}>
          <Feedback tone="warning">{selectionError}</Feedback>
        </div>
      )}
      <div className={styles.tableWrap} aria-busy={loading}>
        <table className={styles.table}>
          <caption className="sr-only">
            Pacientes da página {page}. A seleção do cabeçalho se aplica apenas a esta página.
          </caption>
          <thead>
            <tr>
              <th className={styles.checkboxCell} scope="col">
                <input
                  ref={selectAll}
                  type="checkbox"
                  checked={allSelected}
                  disabled={disabled || loading || !!error || !rows.length || cannotSelectPage}
                  aria-label="Selecionar todos os pacientes desta página"
                  title={
                    cannotSelectPage
                      ? 'Esta página ultrapassaria o limite de 100 selecionados'
                      : 'Selecionar somente esta página'
                  }
                  onChange={(event) => onToggle(rows, event.target.checked)}
                />
              </th>
              <th scope="col">Nome do paciente</th>
              <th scope="col">Telefone</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className={styles.stateCell}>
                  <div className={styles.state}>
                    <span className="spinner spinner-dark" />
                    <strong>Carregando pacientes…</strong>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={3} className={styles.stateCell}>
                  <div className={styles.state}>
                    <span className={styles.emptyIcon}>
                      <Icon name="alert" size={26} />
                    </span>
                    <h3>Não foi possível carregar os pacientes</h3>
                    <p role="alert">{error}</p>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={onRetry}
                      disabled={disabled}
                    >
                      <Icon name="refresh" size={16} />
                      Tentar novamente
                    </button>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.stateCell}>
                  <div className={styles.state}>
                    <span className={styles.emptyIcon}>
                      <Icon name={search ? 'search' : 'patients'} size={28} />
                    </span>
                    <h3>
                      {search ? 'Nenhum paciente encontrado' : 'Sua lista de pacientes começa aqui'}
                    </h3>
                    <p>
                      {search
                        ? 'Tente outro nome ou busque pelo número do telefone.'
                        : 'Importe um arquivo CSV para selecionar pacientes e preparar sua primeira mensagem.'}
                    </p>
                    {search && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => onSearch('')}
                        disabled={disabled}
                      >
                        Limpar busca
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((patient) => (
                <tr
                  key={patient.id}
                  className={selectedIds.has(patient.id) ? styles.selectedRow : ''}
                >
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(patient.id)}
                      disabled={
                        disabled ||
                        (!selectedIds.has(patient.id) && selectedIds.size >= MAX_SEND_PATIENTS)
                      }
                      aria-label={`Selecionar ${patient.name}`}
                      onChange={(event) => onToggle([patient], event.target.checked)}
                    />
                  </td>
                  <td>
                    <span className={styles.patient}>
                      <span className={styles.avatar} aria-hidden="true">
                        {initials(patient.name)}
                      </span>
                      <span className={styles.patientName}>{patient.name}</span>
                    </span>
                  </td>
                  <td className={styles.phone}>{formatPhone(patient.phone)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <footer className={styles.pagination}>
        <div className={styles.pageSize}>
          <label htmlFor="patients-page-size">Por página</label>
          <select
            id="patients-page-size"
            value={limit}
            disabled={disabled || loading}
            onChange={(event) => onLimit(Number(event.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className={styles.pageControls}>
          <span>
            {total > 0
              ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} de ${total.toLocaleString('pt-BR')}`
              : '0 pacientes'}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Página anterior"
            onClick={() => onPage(page - 1)}
            disabled={disabled || loading || !!error || page <= 1}
          >
            <Icon name="chevron-left" size={17} />
          </button>
          <span className={styles.currentPage} aria-label={`Página ${page} de ${pageCount}`}>
            {page}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Próxima página"
            onClick={() => onPage(page + 1)}
            disabled={disabled || loading || !!error || page >= pageCount}
          >
            <Icon name="chevron-right" size={17} />
          </button>
        </div>
      </footer>
      <p className={styles.footnote}>
        <Icon name="info" size={13} /> A seleção é mantida ao mudar de página ou buscar pacientes.
      </p>
    </section>
  );
}

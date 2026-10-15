import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  EmailProviderMode,
  MessageChannel,
  MessageTemplate,
  PaginatedResponse,
  Patient,
} from '../../types';
import { getApiError } from '../../services/api';
import { deletePatients, listPatients } from '../../services/patients';
import { listTemplates } from '../../services/templates';
import { MAX_SEND_PATIENTS } from '../../services/messages';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { CsvImporter } from '../../components/CsvImporter/CsvImporter';
import { PatientTable } from '../../components/PatientTable/PatientTable';
import { TemplateSelect } from '../../components/TemplateSelect/TemplateSelect';
import { TemplateModal } from '../../components/TemplateModal/TemplateModal';
import { SendMessageBar } from '../../components/SendMessageBar/SendMessageBar';
import { Feedback } from '../../components/Feedback/Feedback';
import { Dialog } from '../../components/Dialog/Dialog';
import { Icon } from '../../components/Icon/Icon';
import styles from './Dashboard.module.css';

export function Dashboard({
  emailProvider,
  onBusyChange,
}: {
  emailProvider: EmailProviderMode | null;
  onBusyChange: (busy: boolean) => void;
}) {
  const [response, setResponse] = useState<PaginatedResponse<Patient> | null>(null);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [patientsRevision, setPatientsRevision] = useState(0);
  const [selection, setSelection] = useState<Map<string, Patient>>(new Map());
  const selectedIds = useMemo(() => new Set(selection.keys()), [selection]);
  const [selectionError, setSelectionError] = useState('');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');
  const [templatesRevision, setTemplatesRevision] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateCreated, setTemplateCreated] = useState(false);
  const [sending, setSending] = useState(false);
  const [channels, setChannels] = useState<MessageChannel[]>(['SMS']);
  const [deleteTargets, setDeleteTargets] = useState<Patient[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNotice, setDeleteNotice] = useState('');
  const deleteInFlight = useRef(false);
  const busy = sending || deleting;

  useEffect(() => {
    onBusyChange(busy || templateModalOpen || deleteTargets.length > 0);
  }, [busy, templateModalOpen, deleteTargets.length, onBusyChange]);

  useEffect(() => {
    const controller = new AbortController();
    setPatientsLoading(true);
    setPatientsError('');
    void listPatients({ page, limit, search: debouncedSearch || undefined }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(data.total / limit));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setResponse(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setPatientsError(
            getApiError(cause, 'Não foi possível carregar a lista. Tente novamente em instantes.'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setPatientsLoading(false);
      });
    return () => controller.abort();
  }, [page, limit, debouncedSearch, patientsRevision]);

  useEffect(() => {
    const controller = new AbortController();
    setTemplatesLoading(true);
    setTemplatesError('');
    void listTemplates(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setTemplates(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setTemplatesError(
            getApiError(
              cause,
              'Não foi possível carregar os templates. Tente novamente em instantes.',
            ),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setTemplatesLoading(false);
      });
    return () => controller.abort();
  }, [templatesRevision]);

  function togglePatients(patients: Patient[], select: boolean) {
    if (busy) return;
    const next = new Map(selection);
    for (const patient of patients) {
      if (select) next.set(patient.id, patient);
      else next.delete(patient.id);
    }
    if (next.size > MAX_SEND_PATIENTS) {
      setSelectionError(
        `Selecione no máximo ${MAX_SEND_PATIENTS} pacientes por envio. A seleção desta página não foi adicionada.`,
      );
      return;
    }
    setSelectionError('');
    setSelection(next);
  }

  function clearSelection() {
    setSelection(new Map());
    setSelectionError('');
  }

  function templateSaved(template: MessageTemplate) {
    setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
    setSelectedTemplateId(template.id);
    setTemplateModalOpen(false);
    setTemplateCreated(true);
    setTemplatesRevision((value) => value + 1);
  }

  function requestDelete(patients: Patient[]) {
    if (busy || !patients.length) return;
    setDeleteError('');
    setDeleteNotice('');
    setDeleteTargets(patients);
  }

  async function confirmDelete() {
    if (deleteInFlight.current || !deleteTargets.length || sending) return;
    deleteInFlight.current = true;
    setDeleting(true);
    setDeleteError('');
    const patientIds = deleteTargets.map((patient) => patient.id);
    try {
      const result = await deletePatients(patientIds);
      setSelection((current) => {
        const next = new Map(current);
        for (const id of patientIds) next.delete(id);
        return next;
      });
      setSelectionError('');
      setDeleteTargets([]);
      setDeleteNotice(
        `${result.deleted} ${result.deleted === 1 ? 'paciente excluído' : 'pacientes excluídos'} com o histórico vinculado.`,
      );
      setPatientsRevision((value) => value + 1);
    } catch (error) {
      setDeleteError(
        getApiError(
          error,
          'Não foi possível confirmar a exclusão. Atualize a lista antes de tentar novamente.',
        ),
      );
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  }

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const samplePatient = selection.values().next().value;
  const tableLoading =
    patientsLoading ||
    search.trim() !== debouncedSearch ||
    (!patientsError && !!response && (response.page !== page || response.limit !== limit));

  return (
    <>
      <div className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>COMUNICAÇÃO COM PACIENTES</span>
            <h1>Mensageria Hospitalar</h1>
            <p>Organize seus pacientes e transforme mensagens em cuidado.</p>
          </div>
          <CsvImporter
            disabled={busy}
            onImported={() => {
              setSearch('');
              setPage(1);
              setPatientsRevision((value) => value + 1);
            }}
          />
        </div>
        <ol className={styles.steps} aria-label="Como preparar um envio">
          <li>
            <span className={styles.stepNumber}>01</span>
            <div>
              <strong>Importe os pacientes</strong>
              <p>Adicione sua lista em CSV</p>
            </div>
          </li>
          <li>
            <span className={styles.stepNumber}>02</span>
            <div>
              <strong>Prepare a mensagem</strong>
              <p>Selecione um template</p>
            </div>
          </li>
          <li>
            <span className={styles.stepNumber}>03</span>
            <div>
              <strong>Revise e envie</strong>
              <p>Confirme os destinatários</p>
            </div>
          </li>
        </ol>
        {templateCreated && (
          <div className={styles.createdNotice}>
            <Feedback tone="success">
              Template cadastrado e selecionado. Sua mensagem já está disponível para envio.
            </Feedback>
          </div>
        )}
        {deleteNotice && (
          <div className={styles.createdNotice}>
            <Feedback tone="success">{deleteNotice}</Feedback>
          </div>
        )}
        <div id="pacientes" className={styles.grid}>
          <PatientTable
            response={response}
            loading={tableLoading}
            error={patientsError}
            search={search}
            page={page}
            limit={limit}
            selectedIds={selectedIds}
            disabled={busy}
            onDelete={requestDelete}
            onDeleteSelected={() => requestDelete([...selection.values()])}
            selectionError={selectionError}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onPage={setPage}
            onLimit={(value) => {
              setLimit(value);
              setPage(1);
            }}
            onToggle={togglePatients}
            onClear={clearSelection}
            onRetry={() => setPatientsRevision((value) => value + 1)}
          />
          <TemplateSelect
            emailProvider={emailProvider}
            templates={templates}
            selectedId={selectedTemplateId}
            samplePatient={samplePatient}
            loading={templatesLoading}
            error={templatesError}
            disabled={busy}
            channels={channels}
            onChannelToggle={(channel) =>
              setChannels((current) =>
                current.includes(channel)
                  ? current.filter((item) => item !== channel)
                  : [...current, channel],
              )
            }
            onSelect={setSelectedTemplateId}
            onCreate={() => setTemplateModalOpen(true)}
            onRetry={() => setTemplatesRevision((value) => value + 1)}
          />
        </div>
        <SendMessageBar
          emailProvider={emailProvider}
          patientIds={[...selectedIds]}
          template={selectedTemplate}
          channels={channels}
          missingContacts={{
            SMS: [...selection.values()].filter((patient) => !patient.phone).length,
            EMAIL: [...selection.values()].filter((patient) => !patient.email).length,
          }}
          onBusyChange={setSending}
          onComplete={clearSelection}
        />
      </div>
      {templateModalOpen && (
        <TemplateModal onClose={() => setTemplateModalOpen(false)} onCreated={templateSaved} />
      )}
      {deleteTargets.length > 0 && (
        <Dialog
          title={
            deleteTargets.length === 1
              ? 'Excluir paciente?'
              : `Excluir ${deleteTargets.length} pacientes?`
          }
          description="Esta ação é permanente e não pode ser desfeita."
          busy={deleting}
          onClose={() => setDeleteTargets([])}
        >
          <div className={styles.deleteBody}>
            {deleteTargets.length === 1 ? (
              <p>
                Deseja excluir <strong>{deleteTargets[0]?.name}</strong>?
              </p>
            ) : (
              <p>
                Serão excluídos os <strong>{deleteTargets.length} pacientes selecionados</strong>,
                inclusive de outras páginas.
              </p>
            )}
            <Feedback tone="warning">
              O cadastro, os exames e todas as mensagens do histórico desses pacientes serão
              apagados. Templates serão mantidos. Mensagens já enviadas não podem ser canceladas por
              esta ação.
            </Feedback>
            {deleteError && <Feedback tone="error">{deleteError}</Feedback>}
          </div>
          <footer className={styles.deleteFooter}>
            <button
              type="button"
              className="button button-secondary"
              data-initial-focus="true"
              disabled={deleting}
              onClick={() => setDeleteTargets([])}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`button ${styles.deleteConfirm}`}
              disabled={deleting}
              onClick={() => {
                void confirmDelete();
              }}
            >
              {deleting ? <span className="spinner" /> : <Icon name="trash" size={17} />}
              {deleting ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
          </footer>
        </Dialog>
      )}
    </>
  );
}

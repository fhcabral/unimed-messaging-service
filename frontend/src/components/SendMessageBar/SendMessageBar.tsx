import { useRef, useState } from 'react';
import type { EmailProviderMode, MessageChannel, MessageTemplate, SendResult } from '../../types';
import { DEFAULT_EMAIL_SUBJECT } from '../../services/templates';
import { MAX_SEND_PATIENTS, sendMessages } from '../../services/messages';
import { getApiError } from '../../services/api';
import { Icon } from '../Icon/Icon';
import { Dialog } from '../Dialog/Dialog';
import { Feedback } from '../Feedback/Feedback';
import styles from './SendMessageBar.module.css';

interface Props {
  emailProvider: EmailProviderMode | null;
  patientIds: string[];
  template?: MessageTemplate;
  channels: MessageChannel[];
  missingContacts: Record<MessageChannel, number>;
  onBusyChange: (busy: boolean) => void;
  onComplete: () => void;
}

export function SendMessageBar({
  emailProvider,
  patientIds,
  template,
  channels,
  missingContacts,
  onBusyChange,
  onComplete,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const valid =
    patientIds.length > 0 &&
    patientIds.length <= MAX_SEND_PATIENTS &&
    !!template &&
    channels.length > 0 &&
    (!channels.includes('EMAIL') || !!emailProvider);
  const emailLabel =
    emailProvider === 'MOCK'
      ? 'E-mail simulado'
      : emailProvider === 'SMTP'
        ? 'E-mail real'
        : 'Modo de e-mail indisponível';
  const missingChannels = channels.filter((channel) => missingContacts[channel] > 0);

  async function confirmSend() {
    if (inFlight.current || !valid || !template) return;
    inFlight.current = true;
    setSending(true);
    onBusyChange(true);
    setResult(null);
    setError('');
    try {
      const response = await sendMessages({
        templateId: template.id,
        patientIds: [...patientIds],
        channels: [...channels],
      });
      setResult(response);
      if (response.failed === 0 && response.sent === response.total) onComplete();
    } catch (cause) {
      setError(getApiError(cause, 'Não foi possível confirmar o resultado de todo o lote.'));
    } finally {
      setConfirming(false);
      setSending(false);
      onBusyChange(false);
      inFlight.current = false;
    }
  }

  return (
    <div className={styles.wrapper}>
      <section className={styles.bar} aria-label="Resumo e envio de mensagens">
        <div className={styles.summary}>
          <span className={styles.icon}>
            <Icon name="send" size={20} />
          </span>
          <div>
            <strong>
              {patientIds.length
                ? `${patientIds.length} ${patientIds.length === 1 ? 'paciente selecionado' : 'pacientes selecionados'}`
                : 'Tudo pronto para começar'}
            </strong>
            <p>
              {template ? (
                <>
                  <span>Template:</span> {template.name}
                </>
              ) : (
                'Selecione os pacientes e escolha um template para continuar.'
              )}
            </p>
          </div>
        </div>
        <div className={styles.action}>
          <span className={styles.limit}>Até {MAX_SEND_PATIENTS} pacientes por envio</span>
          <button
            className="button button-primary"
            type="button"
            disabled={!valid || sending}
            onClick={() => setConfirming(true)}
            aria-busy={sending}
          >
            {sending ? <span className="spinner" /> : <Icon name="send" size={17} />}
            {sending ? 'Enviando mensagens…' : 'Enviar mensagens'}
          </button>
        </div>
      </section>
      {missingChannels.length > 0 && (
        <Feedback
          tone="warning"
          title="Alguns pacientes não possuem contato para o canal escolhido"
        >
          {missingChannels
            .map(
              (channel) =>
                `${channel === 'SMS' ? 'SMS: sem telefone' : 'E-mail: sem endereço'} — ${missingContacts[channel]}`,
            )
            .join(' · ')}
          .
          <span className={styles.resultNote}>
            Esses envios serão registrados como falha. Os demais contatos e canais continuam sendo
            processados.
          </span>
        </Feedback>
      )}
      {result && (
        <Feedback
          tone={result.failed ? 'warning' : 'success'}
          title={result.failed ? 'Lote processado com falhas' : 'Lote processado com sucesso'}
        >
          Envios (paciente × canal): <strong className={styles.inline}>{result.total}</strong> ·
          Aceitos: <strong className={styles.inline}>{result.sent}</strong> · Falhas:{' '}
          <strong className={styles.inline}>{result.failed}</strong>.
          {(['SMS', 'EMAIL'] as const).map((channel) => {
            const counts = result.byChannel[channel];
            return counts ? (
              <div className={styles.channelResult} key={channel}>
                <strong className={styles.inline}>
                  {channel === 'SMS' ? 'SMS simulado' : emailLabel}
                </strong>
                : {counts.total} tentativas · {counts.sent} aceitos{' '}
                {channel === 'SMS' || emailProvider === 'MOCK' ? 'pelo mock' : 'pelo SMTP'} ·{' '}
                {counts.failed} falhas.
              </div>
            ) : null;
          })}
          <span className={styles.resultNote}>
            SMS simulado · {emailLabel}. O aceite pelo provider não comprova entrega ao
            destinatário.{' '}
            {result.failed > 0
              ? 'A seleção foi mantida. O resumo não identifica os pacientes que falharam; reenviar este lote pode repetir mensagens já aceitas.'
              : 'A seleção foi limpa para preparar o próximo envio.'}
          </span>
        </Feedback>
      )}
      {error && (
        <Feedback tone="error" title="Não foi possível confirmar o envio">
          {error}
          <span className={styles.resultNote}>
            A seleção foi mantida. Não repita o lote sem verificar o histórico no back-end: parte
            das mensagens pode ter sido processada.
          </span>
        </Feedback>
      )}
      {confirming && (
        <Dialog
          title="Confirmar envio de mensagens"
          description="Revise os destinatários e o template antes de continuar."
          busy={sending}
          onClose={() => setConfirming(false)}
        >
          <div className={styles.confirmBody}>
            <div className={styles.confirmDetails}>
              <div>
                <span>Destinatários</span>
                <strong>
                  {patientIds.length} {patientIds.length === 1 ? 'paciente' : 'pacientes'}
                </strong>
              </div>
              <div>
                <span>Template</span>
                <strong>{template?.name}</strong>
              </div>
              <div>
                <span>Canais</span>
                <strong>
                  {channels
                    .map((channel) => (channel === 'SMS' ? 'SMS simulado' : emailLabel))
                    .join(' + ')}
                </strong>
              </div>
              <div>
                <span>Total de envios</span>
                <strong>{patientIds.length * channels.length} (paciente × canal)</strong>
              </div>
              {channels.includes('EMAIL') && (
                <div>
                  <span>Assunto do e-mail</span>
                  <strong>{template?.subject?.trim() || DEFAULT_EMAIL_SUBJECT}</strong>
                </div>
              )}
            </div>
            {channels.includes('SMS') && (
              <Feedback>
                O canal SMS continua simulado pelo mock, sem envio real ao celular.
              </Feedback>
            )}
            {channels.includes('EMAIL') && (
              <Feedback tone={emailProvider === 'SMTP' ? 'warning' : 'info'} title={emailLabel}>
                {emailProvider === 'SMTP'
                  ? 'Ao confirmar, os e-mails serão enviados de verdade aos endereços cadastrados via SMTP. Confirme os destinatários.'
                  : 'O e-mail será aceito pelo mock, sem conexão externa ou envio real.'}
              </Feedback>
            )}
            {missingChannels.length > 0 && (
              <Feedback tone="warning">
                Há pacientes sem contato para um canal selecionado. Esses envios serão registrados
                como falha e os demais continuarão.
              </Feedback>
            )}
            {(result?.failed || error) && (
              <Feedback tone="warning">
                Um envio anterior teve falhas ou resultado incerto. Reenviar a mesma seleção pode
                duplicar mensagens já aceitas.
              </Feedback>
            )}
          </div>
          <footer className={styles.confirmFooter}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setConfirming(false)}
              disabled={sending}
            >
              Voltar e revisar
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                void confirmSend();
              }}
              disabled={sending || !valid}
            >
              {sending ? <span className="spinner" /> : <Icon name="send" size={17} />}
              {sending ? 'Processando lote…' : 'Confirmar envio'}
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '../../i18n/SettingsProvider';
import type { MessageKey } from '../../i18n/messages';
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  sendTestPush,
  type PushSupport,
} from '../../lib/notifications/client';
import { LEAD_OPTIONS, type DigestMode, type NotifyKinds } from '../../lib/notifications/prefs';

type DeviceState = 'checking' | 'on' | 'off' | 'busy';

const KINDS: NotifyKinds[] = ['all', 'weekly', 'special'];
const DIGESTS: DigestMode[] = ['off', 'daily', 'weekly'];

// Notificaciones: activarlas en este dispositivo y elegir de qué y cuándo avisar.
// Las preferencias son de la cuenta y valen para todos sus dispositivos.
export function NotificationsCard() {
  const { t, notifications: prefs, updateNotifications, locale } = useSettings();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [device, setDevice] = useState<DeviceState>('checking');
  const [message, setMessage] = useState<{ key: MessageKey; error?: boolean; detail?: string } | null>(null);

  // Estado del permiso y la suscripción de este dispositivo (solo existe en el navegador)
  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s !== 'supported') return;
    if (Notification.permission === 'denied') setMessage({ key: 'notif.denied', error: true });
    currentSubscription()
      .then((sub) => setDevice(sub ? 'on' : 'off'))
      .catch(() => setDevice('off'));
  }, []);

  const enable = async () => {
    setDevice('busy');
    setMessage(null);
    const result = await enablePush();
    setDevice(result === 'enabled' ? 'on' : 'off');
    if (result === 'denied') setMessage({ key: 'notif.denied', error: true });
    if (result === 'error') setMessage({ key: 'notif.error', error: true });
  };

  const disable = async () => {
    setDevice('busy');
    await disablePush().catch(() => undefined);
    setDevice('off');
    setMessage(null);
  };

  const test = async () => {
    setMessage(null);
    const result = await sendTestPush();
    if (result.ok) setMessage({ key: 'notif.testSent' });
    else if (result.error === 'Dispositivo no registrado') {
      // El servidor no lo conoce: se vuelve a activar
      setDevice('off');
      setMessage({ key: 'notif.testFailed', error: true });
    } else setMessage({ key: 'notif.testFailed', error: true, detail: result.error });
  };

  const toggleLead = (lead: number) => {
    if (!prefs) return;
    const leads = prefs.leads.includes(lead) ? prefs.leads.filter((l) => l !== lead) : [...prefs.leads, lead];
    updateNotifications({ leads });
  };

  // Horas para el resumen, en el formato del idioma ("09:00" / "9:00 AM")
  const hourLabel = (h: number) =>
    new Date(Date.UTC(2026, 0, 1, h)).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  return (
    <section>
      <h2 className="section-title section-title--solo">{t('notif.title')}</h2>
      <div className="card">
        {/* Este dispositivo */}
        {support === 'ios-install' ? <p className="card-text">{t('notif.iosInstall')}</p> : null}
        {support === 'unsupported' ? <p className="card-text">{t('notif.unsupported')}</p> : null}
        {support === 'not-configured' ? <p className="card-text">{t('notif.notConfigured')}</p> : null}
        {support === 'supported' ? (
          <div className="button-row button-row--flush">
            {device === 'on' ? (
              <>
                <span className="card-text notif-on">✓ {t('notif.enabled')}</span>
                <button type="button" className="button button--ghost" onClick={test}>
                  {t('notif.test')}
                </button>
                <button type="button" className="button button--ghost" onClick={disable}>
                  {t('notif.disable')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button"
                onClick={enable}
                disabled={device === 'busy' || device === 'checking'}
              >
                {t('notif.enable')}
              </button>
            )}
          </div>
        ) : null}
        {message ? (
          <p className={`small setting-help${message.error ? ' text-error' : ' muted'}`} role="status">
            {t(message.key)}
            {message.detail ? <span className="error-detail">{message.detail}</span> : null}
          </p>
        ) : null}

        {/* Preferencias de la cuenta (cargando hasta que llega el perfil) */}
        {!prefs ? (
          <div className="notif-prefs">
            <div className="skeleton-line" aria-hidden="true" />
          </div>
        ) : (
        <div className="notif-prefs">
          <p className="field-label" id="notif-kinds">
            {t('notif.kinds')}
          </p>
          <div className="segment" role="group" aria-labelledby="notif-kinds">
            {KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={prefs.kinds === k} onClick={() => updateNotifications({ kinds: k })}>
                {t(`notif.kinds.${k}` as MessageKey)}
              </button>
            ))}
          </div>
          <p className="muted small">{t('notif.favoritesNote')}</p>

          <p className="field-label" id="notif-leads">
            {t('notif.leads')}
          </p>
          <div className="chips chips--wrap" role="group" aria-labelledby="notif-leads">
            {LEAD_OPTIONS.map((lead) => (
              <button
                key={lead}
                type="button"
                className="chip"
                aria-pressed={prefs.leads.includes(lead)}
                onClick={() => toggleLead(lead)}
              >
                {t(`notif.lead.${lead}` as MessageKey)}
              </button>
            ))}
          </div>
          <p className="muted small">{t('notif.leadsHelp')}</p>

          <div className="row row--field">
            <span id="notif-announce">{t('notif.announce')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.announce && prefs.kinds !== 'weekly'}
              aria-labelledby="notif-announce"
              className="switch"
              disabled={prefs.kinds === 'weekly'}
              onClick={() => updateNotifications({ announce: !prefs.announce })}
            />
          </div>

          <label className="field-label" htmlFor="notif-digest">
            {t('notif.digest')}
          </label>
          <div className="field-pair">
            <select
              id="notif-digest"
              className="select"
              value={prefs.digest}
              onChange={(e) => updateNotifications({ digest: e.target.value as DigestMode })}
            >
              {DIGESTS.map((d) => (
                <option key={d} value={d}>
                  {t(`notif.digest.${d}` as MessageKey)}
                </option>
              ))}
            </select>
            {prefs.digest !== 'off' ? (
              <select
                className="select"
                aria-label={t('notif.digestHour')}
                value={prefs.digestHour}
                onChange={(e) => updateNotifications({ digestHour: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <p className="muted small setting-help">{t('notif.accountNote')}</p>
        </div>
        )}
      </div>
    </section>
  );
}

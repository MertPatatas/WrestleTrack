'use client';

import Link from 'next/link';
import { brandOf } from '../data/brands';
import { isSpecial, type Show } from '../data/types';
import { useT } from '../i18n/SettingsProvider';
import type { Formatter } from '../lib/dates';
import { PromotionBadge } from './PromotionBadge';

// variant "day": dentro de la lista agrupada por días (muestra la hora a la izquierda).
// variant "date": suelto, en portada y columna lateral (muestra la fecha a la izquierda).
export function ShowRow({
  show,
  fmt,
  now = Date.now(),
  variant = 'date',
}: {
  show: Show;
  fmt: Formatter;
  now?: number;
  variant?: 'day' | 'date';
}) {
  const t = useT();
  // Sin hora confirmada no se puede saber si está en directo ni cuántas horas faltan
  const status = show.timeTbd ? { live: false, text: null } : fmt.status(show.startsAt, show.endsAt, now);
  const time = show.timeTbd ? null : fmt.time(show.startsAt);
  const special = isSpecial(show);
  const brand = brandOf(show);
  const details = [show.venue, show.broadcast].filter(Boolean).join(' · ');
  const name = show.night ? `${show.name} · ${t('shows.night', { n: show.night })}` : show.name;

  let left;
  if (variant === 'day') {
    left = (
      <div className="show-time">
        {time ?? <span className="show-tbd">{t('shows.tbd')}</span>}
        {time && show.timeApprox ? <span className="show-tbd">{t('shows.approx')}</span> : null}
      </div>
    );
  } else {
    const { day, month } = fmt.dateParts(show.timeTbd ? show.eventDate : show.startsAt);
    left = (
      <div className="show-date">
        <span className="show-month">{month}</span>
        <span className="show-day">{day}</span>
      </div>
    );
  }

  // Toda la fila abre la página del show (cartelera y dónde verlo)
  return (
    <Link
      href={`/shows/${encodeURIComponent(show.id)}`}
      className={`show-row show-row--link brand-${brand}${special ? ' show-row--special' : ''}${status.live ? ' show-row--live' : ''}`}
    >
      {left}
      <div className="show-info">
        <p className="show-name">
          {special ? (
            <span className="show-star" aria-label={t('shows.special')}>
              ★{' '}
            </span>
          ) : null}
          {name}
        </p>
        {variant === 'date' ? (
          <p className="muted small">
            {time ? `${time}${show.timeApprox ? ` (${t('shows.approx')})` : ''}` : t('shows.tbdLong')}
          </p>
        ) : null}
        {details ? <p className="muted small show-details">{details}</p> : null}
        {show.note ? <p className="small show-note">{show.note}</p> : null}
        {show.tapedOn ? (
          <p className="muted small">{t('shows.taped', { date: fmt.shortDate(show.tapedOn) })}</p>
        ) : null}
      </div>
      <div className="show-side">
        <PromotionBadge id={brand} />
        {status.text ? (
          <span className={status.live ? 'show-live' : 'muted small'}>{status.text}</span>
        ) : null}
      </div>
    </Link>
  );
}

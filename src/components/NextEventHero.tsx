'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Show } from '../data/types';
import { useT } from '../i18n/SettingsProvider';
import { showDayKey, type Formatter } from '../lib/dates';
import { PromoLogo } from './PromoLogo';

/**
 * Cabecera con la imagen del evento o del show (cartel de Wikipedia/NJPW o póster de TVmaze):
 *  - de fondo, la imagen muy desenfocada, que solo aporta sus colores;
 *  - encima, la imagen nítida a su tamaño real, pegada a la derecha y fundida hacia la izquierda
 *    (los carteles son verticales y pequeños: estirarlos a todo el ancho los pixela).
 * Sin imagen, o si no carga, se ve la foto del ring que hay debajo.
 */
export function HeroWithPoster({ image, children }: { image?: string; children: ReactNode }) {
  const bg = image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined;
  return (
    <>
      <div className="hero-bg" aria-hidden="true" />
      {image ? (
        <>
          <div className="hero-bg hero-bg--poster-blur" style={bg} aria-hidden="true" />
          <img
            className="hero-poster-art"
            src={image}
            alt=""
            aria-hidden="true"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </>
      ) : null}
      <div className="hero-content">{children}</div>
    </>
  );
}

// Tarjeta destacada de la portada: el próximo PPV/PLE, con cuenta atrás
export function NextEventHero({ show, fmt, now }: { show: Show; fmt: Formatter; now: number }) {
  const t = useT();
  const start = new Date(show.startsAt).getTime();
  const live = now >= start && now < new Date(show.endsAt).getTime();
  const left = Math.max(0, start - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const name = show.night ? `${show.name} · ${t('shows.night', { n: show.night })}` : show.name;

  return (
    <Link href={`/shows/${encodeURIComponent(show.id)}`} className={`hero brand-${show.promotion}`}>
      <HeroWithPoster image={show.image}>
        <p className="hero-kicker">{t('home.nextBig')}</p>
        <div className="hero-logo">
          <PromoLogo id={show.promotion} height={44} />
        </div>
        <h2 className="hero-title">{name}</h2>
        <p className="hero-meta">
          {fmt.dayHeading(showDayKey(show, fmt), now)}
          {show.timeTbd ? '' : ` · ${fmt.time(show.startsAt)}`}
          {show.venue ? <span className="hero-venue">{show.venue}</span> : null}
        </p>

        {live ? (
          <p className="hero-live">{t('time.live')}</p>
        ) : show.timeTbd ? null : (
          <div className="countdown" aria-label={fmt.status(show.startsAt, show.endsAt, now).text ?? undefined}>
            <span className="countdown-unit">
              <strong>{days}</strong>
              {t('countdown.days')}
            </span>
            <span className="countdown-unit">
              <strong>{String(hours).padStart(2, '0')}</strong>
              {t('countdown.hours')}
            </span>
            <span className="countdown-unit">
              <strong>{String(minutes).padStart(2, '0')}</strong>
              {t('countdown.minutes')}
            </span>
          </div>
        )}

        <span className="hero-cta">{t('home.seeCard')} →</span>
      </HeroWithPoster>
    </Link>
  );
}

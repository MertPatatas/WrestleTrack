'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { Show } from '../data/types';
import { useT } from '../i18n/SettingsProvider';
import { showDayKey, type Formatter } from '../lib/dates';
import { PromoLogo } from './PromoLogo';

/**
 * Cuerpo de las cabeceras con el cartel del evento (Wikipedia o NJPW):
 * el cartel nítido a su tamaño (a la derecha en escritorio, arriba en móvil) y, de fondo, una
 * copia muy desenfocada que da sus colores. Los carteles de Wikipedia son pequeños (política de
 * imágenes con derechos), por eso no se estiran. Sin cartel, o si no carga, el fondo es el ring.
 */
export function HeroWithPoster({ image, alt, children }: { image?: string; alt: string; children: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const poster = image && !failed ? image : undefined;
  return (
    <>
      <div className="hero-bg" aria-hidden="true" />
      {poster ? (
        <div className="hero-bg hero-bg--poster" style={{ backgroundImage: `url(${JSON.stringify(poster)})` }} aria-hidden="true" />
      ) : null}
      <div className={`hero-body${poster ? ' hero-body--poster' : ''}`}>
        {poster ? (
          <img
            className="hero-poster"
            src={poster}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : null}
        <div className="hero-content">{children}</div>
      </div>
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
      <HeroWithPoster image={show.image} alt={name}>
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

'use client';

import { useMemo } from 'react';
import { useSettings } from '../i18n/SettingsProvider';
import type { MessageKey } from '../i18n/messages';
import { daysBetween, utcToZoned } from './schedule/time';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formatea fechas y horas con el idioma y la zona horaria del usuario.
 * Usar solo tras montar en el navegador (la zona del dispositivo no se conoce en el servidor).
 */
export function createFormatter({ locale, timeZone, t }: { locale: string; timeZone: string; t: T }) {
  // Una fecha 'YYYY-MM-DD' (día anunciado) se formatea tal cual, sin moverla de zona
  const dayDate = (key: string) => new Date(`${key}T12:00:00Z`);

  const fmt = {
    timeZone,

    /** "20:00" o "8:00 PM", según el idioma */
    time(iso: string): string {
      return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone });
    },

    /** Día y mes abreviado para la cajita de fecha. Acepta ISO o 'YYYY-MM-DD'. */
    dateParts(value: string): { day: string; month: string } {
      const isDay = DATE_ONLY.test(value);
      const d = isDay ? dayDate(value) : new Date(value);
      const zone = isDay ? 'UTC' : timeZone;
      return {
        day: d.toLocaleDateString(locale, { day: 'numeric', timeZone: zone }),
        month: d.toLocaleDateString(locale, { month: 'short', timeZone: zone }).replace('.', ''),
      };
    },

    /** "6 oct" / "Oct 6" de una fecha 'YYYY-MM-DD' (sin moverla de zona). */
    shortDate(key: string): string {
      return dayDate(key)
        .toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
        .replace('.', '');
    },

    /** Día 'YYYY-MM-DD' en la zona del usuario (para agrupar shows por día). */
    dayKey(value: string | number): string {
      return utcToZoned(typeof value === 'number' ? value : Date.parse(value), timeZone).date;
    },

    /** "Hoy · sábado 3 oct", "Mañana · …", "Lunes 12 oct" */
    dayHeading(key: string, now: number = Date.now()): string {
      const today = fmt.dayKey(now);
      const sameYear = key.slice(0, 4) === today.slice(0, 4);
      const label = dayDate(key)
        .toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: sameYear ? undefined : 'numeric',
          timeZone: 'UTC',
        })
        .replace('.', '')
        // En español sin coma tras el día de la semana: "sábado 3 oct"
        .replace(locale.startsWith('es') ? /,/ : /$^/, '');
      const diff = daysBetween(today, key);
      const relative = diff === 0 ? t('time.today') : diff === 1 ? t('time.tomorrow') : diff === -1 ? t('time.yesterday') : null;
      return relative ? `${relative} · ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
    },

    /** "Hace 5 min", "Hace 3 h"... */
    timeAgo(iso: string, now: number = Date.now()): string {
      const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
      if (mins < 60) return t('time.agoMin', { n: Math.max(mins, 1) });
      const hours = Math.round(mins / 60);
      if (hours < 24) return t('time.agoH', { n: hours });
      return t('time.agoD', { n: Math.round(hours / 24) });
    },

    /** Estado de un show respecto a ahora: en directo, cuánto falta o terminado (text null). */
    status(startsAt: string, endsAt: string, now: number = Date.now()): { live: boolean; text: string | null } {
      const start = new Date(startsAt).getTime();
      const end = new Date(endsAt).getTime();
      if (now >= start && now < end) return { live: true, text: t('time.live') };
      if (now >= end) return { live: false, text: null };
      const mins = Math.round((start - now) / 60000);
      if (mins < 60) return { live: false, text: t('time.inMin', { n: Math.max(mins, 1) }) };
      const hours = Math.round(mins / 60);
      if (hours < 24) return { live: false, text: t('time.inH', { n: hours }) };
      const days = Math.round(hours / 24);
      return { live: false, text: days === 1 ? t('time.inDay') : t('time.inDays', { n: days }) };
    },
  };
  return fmt;
}

export type Formatter = ReturnType<typeof createFormatter>;

/** Formateador con los ajustes actuales; null hasta que se conoce la zona horaria (tras montar). */
export function useFormat(): Formatter | null {
  const { locale, timeZone, t } = useSettings();
  return useMemo(() => (timeZone ? createFormatter({ locale, timeZone, t }) : null), [locale, timeZone, t]);
}

/** "UTC+02:00" de una zona horaria en este momento. */
export function utcOffsetLabel(timeZone: string, at: number = Date.now()): string {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(new Date(at))
      .find((p) => p.type === 'timeZoneName')?.value;
    return name === 'GMT' ? 'UTC+00:00' : (name ?? '').replace('GMT', 'UTC');
  } catch {
    return '';
  }
}

/** Día en el que se muestra un show: si la hora está por confirmar, la fecha anunciada. */
export function showDayKey(show: { startsAt: string; eventDate: string; timeTbd?: boolean }, fmt: Formatter): string {
  return show.timeTbd ? show.eventDate : fmt.dayKey(show.startsAt);
}

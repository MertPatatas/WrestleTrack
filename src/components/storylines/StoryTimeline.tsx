'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Storyline, StorylineBeat } from '../../data/types';
import { useSettings } from '../../i18n/SettingsProvider';
import { PromotionBadge } from '../PromotionBadge';
import { formatDay, KIND_LABELS } from './format';

// LÍNEA DE TIEMPO de varias storylines: una fila por historia (barra de inicio a fin) con sus
// avances como puntos; los momentos clave, más grandes. Al pulsar un punto se ve el detalle.

const DAY_MS = 86_400_000;
const RANGES = { '3m': 92, '6m': 183, '1y': 366, all: 0 } as const;
type Range = keyof typeof RANGES;
// Mínimo de píxeles por día: el periodo ocupa el ancho disponible y, si no cabe con este mínimo, se desplaza
const MIN_SCALE: Record<Range, number> = { '3m': 4, '6m': 2.4, '1y': 1.3, all: 0.5 };

const toMs = (day: string) => Date.parse(`${day}T12:00:00Z`);
const today = () => new Date().toISOString().slice(0, 10);

function bounds(s: Storyline, now: string): [string, string] {
  const first = s.startedOn ?? s.beats[0]?.date ?? now;
  const last = s.status === 'active' ? now : (s.endedOn ?? s.beats[s.beats.length - 1]?.date ?? first);
  return [first, last < first ? first : last];
}

export function StoryTimeline({ storylines }: { storylines: Storyline[] }) {
  const { t, locale } = useSettings();
  const [range, setRange] = useState<Range>('3m');
  const [selected, setSelected] = useState<{ story: Storyline; beat: StorylineBeat } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(600); // ancho visible para las pistas
  const now = today();

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const label = () => parseFloat(getComputedStyle(el).getPropertyValue('--tl-label')) || 170;
    const measure = () => setAvailable(Math.max(200, el.clientWidth - label()));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [storylines.length]);

  const view = useMemo(() => {
    const end = toMs(now) + 10 * DAY_MS; // un poco de aire tras hoy
    let start: number;
    if (range === 'all') {
      start = Math.min(...storylines.map((s) => toMs(bounds(s, now)[0])), toMs(now) - 30 * DAY_MS) - 15 * DAY_MS;
    } else {
      start = end - RANGES[range] * DAY_MS;
    }
    const days = (end - start) / DAY_MS;
    const width = Math.round(Math.max(available, days * MIN_SCALE[range]));
    const pct = (day: string) => ((toMs(day) - start) / (end - start)) * 100;

    const rows = storylines
      .map((s) => ({ s, b: bounds(s, now) }))
      .filter(({ b }) => toMs(b[1]) >= start && toMs(b[0]) <= end)
      .sort((x, y) => x.b[0].localeCompare(y.b[0]));

    // Marcas de mes (o de año, si el periodo es largo)
    const ticks: { left: number; label: string; major: boolean }[] = [];
    const d = new Date(start);
    d.setUTCDate(1);
    d.setUTCHours(12, 0, 0, 0);
    const yearly = days > 800;
    while (d.getTime() <= end) {
      if (d.getTime() >= start && (!yearly || d.getUTCMonth() === 0)) {
        const day = d.toISOString().slice(0, 10);
        const major = d.getUTCMonth() === 0;
        ticks.push({
          left: pct(day),
          major,
          label: yearly
            ? String(d.getUTCFullYear())
            : d.toLocaleDateString(locale, { month: 'short', year: major ? 'numeric' : undefined, timeZone: 'UTC' }).replace('.', ''),
        });
      }
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return { rows, ticks, width, pct, startDay: new Date(start).toISOString().slice(0, 10) };
  }, [storylines, range, now, locale, available]);

  // Al cambiar de periodo se muestra lo más reciente (a la derecha)
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [range, view.width]);

  const clamp = (v: number) => Math.min(100, Math.max(0, v));

  return (
    <div className="timeline">
      <div className="kind-filter" role="group" aria-label={t('timeline.rangeAria')}>
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <button key={r} type="button" className="chip" aria-pressed={range === r} onClick={() => setRange(r)}>
            {t(`timeline.range.${r}`)}
          </button>
        ))}
      </div>

      {view.rows.length === 0 ? (
        <p className="empty">{t('timeline.empty')}</p>
      ) : (
        <div className="timeline-frame card">
          <div className="timeline-scroll" ref={scroller}>
            <div className="timeline-grid" style={{ width: `calc(var(--tl-label) + ${view.width}px)` }}>
              {/* Eje de fechas */}
              <div className="timeline-axis">
                <div className="timeline-label timeline-label--axis" />
                <div className="timeline-track">
                  {view.ticks.map((tk) => (
                    <span key={tk.left} className={`timeline-tick${tk.major ? ' timeline-tick--major' : ''}`} style={{ left: `${tk.left}%` }}>
                      {tk.label}
                    </span>
                  ))}
                  <span className="timeline-today" style={{ left: `${view.pct(now)}%` }}>
                    {t('time.today')}
                  </span>
                </div>
              </div>

              {view.rows.map(({ s, b }) => (
                <div key={s.id} className={`timeline-row brand-${s.promotion}`}>
                  <Link href={`/storyline/${s.id}`} className="timeline-label">
                    <PromotionBadge id={s.promotion} size={12} />
                    <span className="timeline-name">{s.title}</span>
                  </Link>
                  <div className="timeline-track">
                    {view.ticks.map((tk) => (
                      <span key={tk.left} className="timeline-gridline" style={{ left: `${tk.left}%` }} aria-hidden="true" />
                    ))}
                    <span className="timeline-now" style={{ left: `${view.pct(now)}%` }} aria-hidden="true" />
                    <span
                      className={`timeline-bar${s.status === 'active' ? ' timeline-bar--active' : ''}`}
                      style={{ left: `${clamp(view.pct(b[0]))}%`, width: `${Math.max(0.6, clamp(view.pct(b[1])) - clamp(view.pct(b[0])))}%` }}
                      aria-hidden="true"
                    />
                    {s.beats
                      .filter((beat) => beat.date >= view.startDay)
                      .map((beat) => {
                        const isSel = selected?.beat.id === beat.id;
                        return (
                          <button
                            key={beat.id}
                            type="button"
                            className={`timeline-dot timeline-dot--${beat.importance}${isSel ? ' timeline-dot--selected' : ''}`}
                            style={{ left: `${view.pct(beat.date)}%` }}
                            aria-label={`${s.title}: ${formatDay(beat.date, locale)} · ${beat.title}`}
                            aria-pressed={isSel}
                            onClick={() => setSelected(isSel ? null : { story: s, beat })}
                          />
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selected ? (
        <article key={selected.beat.id} className={`card timeline-detail fade-in brand-${selected.story.promotion}`} aria-live="polite">
          <div className="card-meta card-meta--between">
            <span className="muted small">
              {formatDay(selected.beat.date, locale)}
              {selected.beat.showName ? ` · ${selected.beat.showName}` : ''}
            </span>
            <span className={`beat-kind${selected.beat.importance === 3 ? ' beat-kind--key' : ''}`}>{t(KIND_LABELS[selected.beat.kind])}</span>
          </div>
          <p className="timeline-detail-story">{selected.story.title}</p>
          <h3 className="card-title">{selected.beat.title}</h3>
          <p className="card-text">{selected.beat.text}</p>
          <Link className="link" href={`/storyline/${selected.story.id}`}>
            {t('timeline.openStory')} →
          </Link>
        </article>
      ) : (
        <p className="muted small timeline-hint">{t('timeline.hint')}</p>
      )}
    </div>
  );
}

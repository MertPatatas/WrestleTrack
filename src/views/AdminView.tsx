'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PromotionBadge } from '../components/PromotionBadge';
import { BEAT_KINDS, type AdminStoryline, type BeatKind, type PromotionId, type StorylineBeat } from '../data/types';
import { useSettings } from '../i18n/SettingsProvider';

// ADMINISTRACIÓN DE STORYLINES (solo para las cuentas de ADMIN_EMAILS). Herramienta interna:
// los textos van en español, sin traducir.
//   - Revisar lo que propone la IA: storylines nuevas, avances y cambios de resumen/estado.
//   - Editar las publicadas y añadir avances a mano.
//   - Lanzar la IA: procesar el siguiente show o crear una storyline histórica (Wikipedia).

interface AdminData {
  stories: AdminStoryline[];
  jobs: { showId: string; status: string; detail: string | null; at: string }[];
  gemini: boolean;
}

const PROMOTIONS: PromotionId[] = ['wwe', 'aew', 'cmll', 'aaa', 'njpw', 'other'];
const KIND_NAMES: Record<BeatKind, string> = {
  match: 'Combate',
  promo: 'Promo',
  attack: 'Ataque',
  announcement: 'Anuncio',
  title_change: 'Cambio de título',
  turn: 'Cambio de bando',
  return: 'Regreso',
  other: 'Otro',
};

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/admin/storylines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
  return data;
}

const csv = (list: string[]) => list.join(', ');
const fromCsv = (text: string) =>
  text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

// ---------------------------------------------------------------- Un avance

function BeatRow({ beat, onChange }: { beat: StorylineBeat; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(beat);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await post(body);
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const pending = beat.status === 'pending';
  return (
    <li className={`admin-beat${pending ? ' admin-beat--pending' : ''}`}>
      {editing ? (
        <div className="admin-form">
          <div className="admin-row">
            <input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            <select className="select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as BeatKind })}>
              {BEAT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_NAMES[k]}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={draft.importance}
              onChange={(e) => setDraft({ ...draft, importance: Number(e.target.value) as 1 | 2 | 3 })}
            >
              <option value={1}>Menor</option>
              <option value={2}>Normal</option>
              <option value={3}>★ Clave</option>
            </select>
          </div>
          <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea className="input admin-textarea" rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <div className="button-row button-row--flush">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() =>
                run({
                  action: 'editBeat',
                  beatId: beat.id,
                  fields: { date: draft.date, title: draft.title, text: draft.text, kind: draft.kind, importance: draft.importance },
                })
              }
            >
              Guardar
            </button>
            <button type="button" className="button button--ghost" disabled={busy} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted small">
            {beat.date}
            {beat.showName ? ` · ${beat.showName}` : ''} · {KIND_NAMES[beat.kind]}
            {beat.importance === 3 ? ' · ★ clave' : beat.importance === 1 ? ' · menor' : ''}
            {pending ? ' · PENDIENTE' : ''}
          </p>
          <p className="admin-beat-title">{beat.title}</p>
          <p className="card-text">{beat.text}</p>
          <div className="button-row button-row--flush">
            {pending ? (
              <button type="button" className="button" disabled={busy} onClick={() => run({ action: 'beatStatus', beatId: beat.id, status: 'approved' })}>
                Aprobar
              </button>
            ) : null}
            <button type="button" className="button button--ghost" disabled={busy} onClick={() => setEditing(true)}>
              Editar
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={busy}
              onClick={() => run({ action: 'beatStatus', beatId: beat.id, status: 'rejected' })}
            >
              {pending ? 'Descartar' : 'Quitar'}
            </button>
            {beat.sourceUrl ? (
              <a className="link" href={beat.sourceUrl} target="_blank" rel="noopener noreferrer">
                Fuente ↗
              </a>
            ) : null}
          </div>
        </>
      )}
      {error ? <p className="small text-error">{error}</p> : null}
    </li>
  );
}

// ---------------------------------------------------------------- Una storyline

function StoryAdmin({ story, all, onChange, startOpen }: { story: AdminStoryline; all: AdminStoryline[]; onChange: () => void; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [form, setForm] = useState({
    title: story.title,
    promotion: story.promotion,
    summary: story.summary,
    participants: csv(story.participants),
    status: story.status,
    startedOn: story.startedOn ?? '',
    endedOn: story.endedOn ?? '',
    related: csv(story.related),
  });
  const [newBeat, setNewBeat] = useState<null | { date: string; title: string; text: string; kind: BeatKind; importance: 1 | 2 | 3 }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingBeats = story.beats.filter((b) => b.status === 'pending');

  const run = async (body: Record<string, unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await post(body);
      after?.();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const fields = () => ({
    title: form.title,
    promotion: form.promotion,
    summary: form.summary,
    participants: fromCsv(form.participants),
    status: form.status,
    startedOn: form.startedOn || undefined,
    endedOn: form.endedOn || undefined,
    related: fromCsv(form.related),
  });

  return (
    <article className={`card admin-story brand-${story.promotion}`}>
      <button type="button" className="admin-story-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <PromotionBadge id={story.promotion} />
        <span className="admin-story-title">{story.title}</span>
        <span className="muted small">
          {!story.published ? 'NUEVA · ' : ''}
          {story.status === 'active' ? 'en curso' : 'terminada'} · {story.beats.length} avances
          {pendingBeats.length ? ` · ${pendingBeats.length} pendientes` : ''}
          {story.pending ? ' · cambios propuestos' : ''}
        </span>
      </button>

      {open ? (
        <div className="admin-story-body">
          {story.pending ? (
            <div className="admin-proposal">
              <p className="admin-label">Cambios propuestos por la IA</p>
              {story.pending.summary ? (
                <>
                  <p className="muted small">Resumen actual:</p>
                  <p className="card-text">{story.summary}</p>
                  <p className="muted small">Resumen propuesto:</p>
                  <p className="card-text admin-new">{story.pending.summary}</p>
                </>
              ) : null}
              {story.pending.status === 'closed' ? <p className="card-text admin-new">Propone dar la storyline por terminada.</p> : null}
              <div className="button-row button-row--flush">
                <button type="button" className="button" disabled={busy} onClick={() => run({ action: 'pending', id: story.id, accept: true })}>
                  Aceptar cambios
                </button>
                <button type="button" className="button button--ghost" disabled={busy} onClick={() => run({ action: 'pending', id: story.id, accept: false })}>
                  Descartar
                </button>
              </div>
            </div>
          ) : null}

          <div className="admin-form">
            <label className="admin-label">
              Título
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <div className="admin-row">
              <label className="admin-label">
                Empresa
                <select className="select" value={form.promotion} onChange={(e) => setForm({ ...form, promotion: e.target.value as PromotionId })}>
                  {PROMOTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-label">
                Estado
                <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'closed' })}>
                  <option value="active">En curso</option>
                  <option value="closed">Terminada</option>
                </select>
              </label>
              <label className="admin-label">
                Inicio
                <input className="input" type="date" value={form.startedOn} onChange={(e) => setForm({ ...form, startedOn: e.target.value })} />
              </label>
              <label className="admin-label">
                Fin
                <input className="input" type="date" value={form.endedOn} onChange={(e) => setForm({ ...form, endedOn: e.target.value })} />
              </label>
            </div>
            <label className="admin-label">
              Resumen
              <textarea className="input admin-textarea" rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </label>
            <label className="admin-label">
              Participantes (separados por comas)
              <input className="input" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
            </label>
            <label className="admin-label">
              Storylines de contexto (ids separados por comas)
              <input className="input" value={form.related} onChange={(e) => setForm({ ...form, related: e.target.value })} list={`ids-${story.id}`} />
              <datalist id={`ids-${story.id}`}>
                {all
                  .filter((s) => s.id !== story.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </datalist>
            </label>
            <p className="muted small">Id: {story.id}</p>
            <div className="button-row button-row--flush">
              {!story.published ? (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => run({ action: 'update', id: story.id, fields: fields() }).then(() => run({ action: 'publish', id: story.id }))}
                >
                  Publicar (con sus avances)
                </button>
              ) : null}
              <button type="button" className={story.published ? 'button' : 'button button--ghost'} disabled={busy} onClick={() => run({ action: 'update', id: story.id, fields: fields() })}>
                Guardar cambios
              </button>
              {story.published ? (
                <Link className="link" href={`/storyline/${story.id}`}>
                  Ver en la web →
                </Link>
              ) : null}
              <button
                type="button"
                className="button button--danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`¿Borrar "${story.title}" y todos sus avances? No se puede deshacer.`)) void run({ action: 'delete', id: story.id });
                }}
              >
                {story.published ? 'Borrar' : 'Descartar'}
              </button>
            </div>
            {error ? <p className="small text-error">{error}</p> : null}
          </div>

          <p className="admin-label">Avances ({story.beats.length})</p>
          <ol className="admin-beats">
            {[...story.beats].reverse().map((b) => (
              <BeatRow key={b.id} beat={b} onChange={onChange} />
            ))}
          </ol>
          {pendingBeats.length > 1 ? (
            <button
              type="button"
              className="button button--ghost"
              disabled={busy}
              onClick={async () => {
                for (const b of pendingBeats) await post({ action: 'beatStatus', beatId: b.id, status: 'approved' });
                onChange();
              }}
            >
              Aprobar los {pendingBeats.length} pendientes
            </button>
          ) : null}

          {newBeat ? (
            <div className="admin-form admin-proposal">
              <p className="admin-label">Nuevo avance (se publica directamente)</p>
              <div className="admin-row">
                <input className="input" type="date" value={newBeat.date} onChange={(e) => setNewBeat({ ...newBeat, date: e.target.value })} />
                <select className="select" value={newBeat.kind} onChange={(e) => setNewBeat({ ...newBeat, kind: e.target.value as BeatKind })}>
                  {BEAT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_NAMES[k]}
                    </option>
                  ))}
                </select>
                <select className="select" value={newBeat.importance} onChange={(e) => setNewBeat({ ...newBeat, importance: Number(e.target.value) as 1 | 2 | 3 })}>
                  <option value={1}>Menor</option>
                  <option value={2}>Normal</option>
                  <option value={3}>★ Clave</option>
                </select>
              </div>
              <input className="input" placeholder="Título" value={newBeat.title} onChange={(e) => setNewBeat({ ...newBeat, title: e.target.value })} />
              <textarea className="input admin-textarea" rows={3} placeholder="Qué pasó" value={newBeat.text} onChange={(e) => setNewBeat({ ...newBeat, text: e.target.value })} />
              <div className="button-row button-row--flush">
                <button type="button" className="button" disabled={busy || !newBeat.title || !newBeat.text} onClick={() => run({ action: 'addBeat', id: story.id, fields: newBeat }, () => setNewBeat(null))}>
                  Añadir
                </button>
                <button type="button" className="button button--ghost" onClick={() => setNewBeat(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setNewBeat({ date: new Date().toISOString().slice(0, 10), title: '', text: '', kind: 'other', importance: 2 })}
            >
              + Añadir avance a mano
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------- Página

export function AdminView() {
  const { isAdmin, authReady, user } = useSettings();
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [wikiUrl, setWikiUrl] = useState('');
  const [working, setWorking] = useState<null | 'process' | 'historical'>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/storylines', { cache: 'no-store' });
      const body = (await res.json()) as AdminData & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!authReady) return <div className="skeleton-line skeleton-line--title" aria-hidden="true" />;
  if (!user || !isAdmin) {
    return (
      <div className="detail">
        <h1 className="page-title">Administración</h1>
        <p className="empty">Esta página es solo para administradores.</p>
      </div>
    );
  }

  const runAction = async (kind: 'process' | 'historical') => {
    setWorking(kind);
    setMessage(null);
    try {
      const res = await post(kind === 'process' ? { action: 'process' } : { action: 'historical', topic, url: wikiUrl || undefined });
      const r = res.result as Record<string, unknown>;
      if (kind === 'process') {
        setMessage(
          r.skipped
            ? { ok: true, text: String(r.skipped) }
            : r.error
              ? { ok: false, text: `${r.show}: ${r.error}` }
              : { ok: true, text: `${r.show}: ${r.updates} avances propuestos y ${r.created} storylines nuevas.` },
        );
      } else {
        setMessage({ ok: true, text: `Borrador creado: "${r.title}" con ${r.beats} avances (fuente: ${r.source}). Revísalo abajo y publícalo.` });
        setTopic('');
        setWikiUrl('');
      }
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setWorking(null);
    }
  };

  const stories = data?.stories ?? [];
  const toReview = stories.filter((s) => !s.published || s.pending || s.beats.some((b) => b.status === 'pending'));
  const published = stories.filter((s) => s.published && !toReview.includes(s));

  return (
    <div className="admin">
      <h1 className="page-title">Administración</h1>
      <p className="muted small notice">
        Lo que propone la IA no se ve en la web hasta que lo apruebas. Cada media hora se procesa como mucho un show nuevo (el día
        después de emitirse).
      </p>

      <section className="card">
        <h2 className="section-title">IA (Gemini)</h2>
        {data && !data.gemini ? (
          <p className="small text-error">Falta la variable GEMINI_API_KEY en el servidor: la IA no puede generar nada.</p>
        ) : null}
        <div className="button-row button-row--flush">
          <button type="button" className="button" disabled={working !== null || !data?.gemini} onClick={() => runAction('process')}>
            {working === 'process' ? 'Procesando… (hasta 1 min)' : 'Procesar el siguiente show ahora'}
          </button>
        </div>
        <div className="admin-form">
          <p className="admin-label">Storyline histórica (contexto)</p>
          <input className="input" placeholder="Tema: The Bloodline, The Shield, Elite vs. Jericho…" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <input className="input" placeholder="Enlace de Wikipedia en inglés (opcional)" value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)} />
          <div className="button-row button-row--flush">
            <button type="button" className="button button--ghost" disabled={working !== null || !topic.trim() || !data?.gemini} onClick={() => runAction('historical')}>
              {working === 'historical' ? 'Generando… (hasta 1 min)' : 'Generar borrador'}
            </button>
          </div>
        </div>
        {message ? <p className={message.ok ? 'small admin-ok' : 'small text-error'}>{message.text}</p> : null}
        {data?.jobs.length ? (
          <details className="admin-jobs">
            <summary className="muted small">Últimos shows procesados</summary>
            <ul>
              {data.jobs.map((j) => (
                <li key={j.showId} className="small">
                  <span className={j.status === 'done' ? 'admin-ok' : 'text-error'}>{j.status === 'done' ? '✓' : '✗'}</span> {j.showId} —{' '}
                  {j.detail ?? ''} <span className="muted">({new Date(j.at).toLocaleString()})</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {loadError ? <p className="small text-error">{loadError}</p> : null}
      {!data && !loadError ? <div className="skeleton-line skeleton-line--title" aria-hidden="true" /> : null}

      {data ? (
        <>
          <h2 className="section-title section-title--solo">Pendiente de revisar ({toReview.length})</h2>
          {toReview.length === 0 ? <p className="muted small">Nada pendiente.</p> : null}
          <div className="stack">
            {toReview.map((s) => (
              <StoryAdmin key={`${s.id}:${s.updatedAt}:${s.beats.length}`} story={s} all={stories} onChange={load} startOpen />
            ))}
          </div>

          <h2 className="section-title section-title--solo">Publicadas ({published.length})</h2>
          <div className="stack">
            {published.map((s) => (
              <StoryAdmin key={`${s.id}:${s.updatedAt}:${s.beats.length}`} story={s} all={stories} onChange={load} startOpen={false} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

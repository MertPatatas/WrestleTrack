'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { WrestlerPhoto } from '../../data/types';
import { WrestlerAvatar } from '../wrestlers/WrestlerAvatar';

// ADMINISTRACIÓN DE FOTOS DE LUCHADORES (textos solo en español, herramienta interna):
// ver la foto de cada uno, elegir otra con licencia libre (Openverse), subir una propia,
// dejarle sin foto o ajustar dónde está la cara para el recorte en círculo.

interface Row {
  key: string;
  name: string;
  wiki: string | null;
  photo: WrestlerPhoto | null;
  locked: boolean;
}
type Candidate = WrestlerPhoto & { title: string };

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/admin/wrestlers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
  return data;
}

/** Reduce una imagen a 400 px como máximo y la pasa a WebP (en el navegador, antes de subirla). */
async function toWebp(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL('image/webp', 0.85);
  if (!data.startsWith('data:image/webp')) throw new Error('Este navegador no puede convertir la imagen a WebP');
  return data;
}

function sourceLabel(p: WrestlerPhoto | null, locked: boolean): string {
  if (!p) return locked ? 'Sin foto (fijado)' : 'Sin foto';
  const origin = { wikipedia: 'Wikipedia', openverse: 'Openverse', upload: 'Subida', manual: 'Elegida' }[p.source];
  return [origin, p.license, locked ? 'fijada' : null].filter(Boolean).join(' · ');
}

function WrestlerEditor({ row, onChange }: { row: Row; onChange: () => void }) {
  const [focus, setFocus] = useState({ x: row.photo?.focusX ?? 50, y: row.photo?.focusY ?? 25 });
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [credit, setCredit] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (label: string, body: Record<string, unknown>, after?: (data: Record<string, unknown>) => void) => {
    setBusy(label);
    setError(null);
    try {
      const data = await post({ key: row.key, name: row.name, ...body });
      after ? after(data) : onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  // Clic sobre la foto completa: ahí está la cara
  const pickFocus = (e: MouseEvent<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setFocus({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
  };

  const preview = row.photo ? { ...row.photo, focusX: focus.x, focusY: focus.y } : null;

  return (
    <div className="admin-wrestler-editor">
      {row.photo ? (
        <div className="admin-focus">
          <div className="admin-focus-frame">
            <img src={row.photo.url} alt="" onClick={pickFocus} referrerPolicy="no-referrer" />
            <span className="admin-focus-dot" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} />
          </div>
          <div className="admin-focus-side">
            <p className="muted small">Pulsa sobre la cara para centrar el recorte:</p>
            <div className="admin-focus-previews">
              <WrestlerAvatar name={row.name} photo={preview} size={72} />
              <WrestlerAvatar name={row.name} photo={preview} size={40} />
            </div>
            <button
              type="button"
              className="button"
              disabled={busy !== null || (focus.x === row.photo.focusX && focus.y === row.photo.focusY)}
              onClick={() => run('focus', { action: 'set', photo: { ...row.photo, focusX: focus.x, focusY: focus.y } })}
            >
              Guardar encuadre
            </button>
            {row.photo.creditUrl ? (
              <a className="link small" href={row.photo.creditUrl} target="_blank" rel="noopener noreferrer">
                {row.photo.credit ?? 'Origen'} ↗
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="button-row button-row--flush">
        <button type="button" className="button button--ghost" disabled={busy !== null} onClick={() => run('search', { action: 'candidates' }, (d) => setCandidates((d.candidates as Candidate[]) ?? []))}>
          {busy === 'search' ? 'Buscando…' : 'Buscar otras fotos (licencia libre)'}
        </button>
        <button type="button" className="button button--ghost" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
          {busy === 'upload' ? 'Subiendo…' : 'Subir foto'}
        </button>
        <button type="button" className="button button--ghost" disabled={busy !== null} onClick={() => run('none', { action: 'none' })}>
          Sin foto
        </button>
        {row.locked ? (
          <button type="button" className="button button--ghost" disabled={busy !== null} onClick={() => run('reset', { action: 'reset' })}>
            Volver a automática
          </button>
        ) : null}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const data = await toWebp(file);
            await run('upload', { action: 'upload', data, credit });
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      />
      <input className="input" placeholder="Autor de la foto que vas a subir (opcional)" value={credit} onChange={(e) => setCredit(e.target.value)} />
      <p className="muted small">Sube solo fotos que puedas usar: tuyas, con licencia libre o con permiso de su autor.</p>

      {candidates ? (
        candidates.length ? (
          <div className="admin-candidates">
            {candidates.map((c) => (
              <figure key={c.url} className="admin-candidate">
                {/* Si la foto ya no existe en su web, se oculta la opción */}
                <img
                  src={c.url}
                  alt={c.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => ((e.currentTarget.closest('figure') as HTMLElement).hidden = true)}
                />
                <figcaption className="small">
                  <span className="admin-candidate-title">{c.title}</span>
                  <span className="muted">
                    {c.credit ?? '—'} · {c.license}
                  </span>
                </figcaption>
                <button
                  type="button"
                  className="button"
                  disabled={busy !== null}
                  onClick={() => {
                    const { title: _t, ...photo } = c;
                    void run('pick', { action: 'set', photo });
                  }}
                >
                  Usar esta
                </button>
              </figure>
            ))}
          </div>
        ) : (
          <p className="muted small">No hay fotos con licencia libre con ese nombre.</p>
        )
      ) : null}
      {error ? <p className="small text-error">{error}</p> : null}
    </div>
  );
}

export function AdminWrestlers() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/admin/wrestlers?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const data = (await res.json()) as { wrestlers?: Row[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows(data.wrestlers ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Búsqueda con una pequeña espera mientras se escribe
  useEffect(() => {
    const timer = setTimeout(() => void load(query), 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const data = await post({ action: 'add', name });
      setNewName('');
      setQuery(name);
      setOpen(String(data.key));
      await load(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="admin">
      <p className="muted small">
        Las fotos se buscan solas la primera vez que un luchador aparece en una cartelera: primero en Wikipedia y si no, en Openverse
        (siempre con licencia libre). Aquí puedes cambiarlas; lo que elijas queda fijado.
      </p>
      <div className="admin-row">
        <input className="input" placeholder="Buscar luchador…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <input className="input" placeholder="Añadir por nombre" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
        <button type="button" className="button button--ghost" disabled={!newName.trim()} onClick={() => void add()}>
          Añadir
        </button>
      </div>
      {error ? <p className="small text-error">{error}</p> : null}
      {rows === null ? <div className="skeleton-line" aria-hidden="true" /> : null}
      {rows?.length === 0 ? <p className="muted small">Ningún luchador guardado con ese nombre.</p> : null}

      <div className="stack stack--tight">
        {rows?.map((row) => (
          <article key={row.key} className="card admin-wrestler">
            <button type="button" className="admin-wrestler-head" aria-expanded={open === row.key} onClick={() => setOpen(open === row.key ? null : row.key)}>
              <WrestlerAvatar name={row.name} photo={row.photo} size={48} />
              <span className="admin-wrestler-name">{row.name}</span>
              <span className="muted small">{sourceLabel(row.photo, row.locked)}</span>
            </button>
            {open === row.key ? <WrestlerEditor key={JSON.stringify(row.photo)} row={row} onChange={() => void load(query)} /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

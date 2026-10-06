import 'server-only';
import { BEAT_KINDS, type AdminStoryline, type BeatKind, type PromotionId, type Storyline, type StorylineBeat, type StorylineStatus } from '../../data/types';
import { db } from '../server/db';

// Lectura y escritura de storylines y sus avances (tablas app.storylines y app.storyline_beats).

interface StoryRow {
  id: string;
  promotion: PromotionId;
  title: string;
  summary: string;
  participants: string[];
  status: StorylineStatus;
  started_on: string | null;
  ended_on: string | null;
  related: string[];
  published: boolean;
  pending: AdminStoryline['pending'] | string | null;
  updated_at: Date;
}

interface BeatRow {
  id: string; // bigserial llega como texto
  storyline_id: string;
  date: string;
  show_id: string | null;
  show_name: string | null;
  title: string;
  text: string;
  kind: BeatKind;
  importance: number;
  source_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
}

export interface BeatDraft {
  date: string;
  showId?: string;
  showName?: string;
  title: string;
  text: string;
  kind: BeatKind;
  importance: 1 | 2 | 3;
  sourceUrl?: string;
}

export interface StorylineDraft {
  promotion: PromotionId;
  title: string;
  summary: string;
  participants: string[];
  status: StorylineStatus;
  startedOn?: string;
  endedOn?: string;
  related: string[];
}

const toBeat = (b: BeatRow, withStatus: boolean): StorylineBeat => ({
  id: Number(b.id),
  date: b.date,
  showId: b.show_id ?? undefined,
  showName: b.show_name ?? undefined,
  title: b.title,
  text: b.text,
  kind: (BEAT_KINDS as readonly string[]).includes(b.kind) ? b.kind : 'other',
  importance: Math.min(3, Math.max(1, b.importance)) as 1 | 2 | 3,
  sourceUrl: b.source_url ?? undefined,
  ...(withStatus ? { status: b.status } : {}),
});

const parsePending = (p: StoryRow['pending']): AdminStoryline['pending'] => (typeof p === 'string' ? JSON.parse(p) : p);

function assemble(rows: StoryRow[], beats: BeatRow[], admin: boolean): AdminStoryline[] {
  const byStory = new Map<string, StorylineBeat[]>();
  for (const b of beats) {
    const list = byStory.get(b.storyline_id) ?? [];
    list.push(toBeat(b, admin));
    byStory.set(b.storyline_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    promotion: r.promotion,
    title: r.title,
    summary: r.summary,
    participants: r.participants ?? [],
    status: r.status,
    startedOn: r.started_on ?? undefined,
    endedOn: r.ended_on ?? undefined,
    related: r.related ?? [],
    beats: (byStory.get(r.id) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
    updatedAt: r.updated_at.toISOString(),
    published: r.published,
    pending: parsePending(r.pending),
  }));
}

/** Storylines publicadas con sus avances aprobados (para la web). */
export async function listPublished(): Promise<Storyline[]> {
  const q = await db();
  const [rows, beats] = await Promise.all([
    q.query<StoryRow>('select * from app.storylines where published order by updated_at desc'),
    q.query<BeatRow>(
      `select b.* from app.storyline_beats b join app.storylines s on s.id = b.storyline_id
       where s.published and b.status = 'approved'`,
    ),
  ]);
  return assemble(rows, beats, false).map(({ published: _p, pending: _q, ...s }) => s);
}

/** Todas las storylines con sus avances aprobados y pendientes (para la administración). */
export async function listAll(): Promise<AdminStoryline[]> {
  const q = await db();
  const [rows, beats] = await Promise.all([
    q.query<StoryRow>('select * from app.storylines order by updated_at desc'),
    q.query<BeatRow>(`select * from app.storyline_beats where status <> 'rejected'`),
  ]);
  return assemble(rows, beats, true);
}

/** Id legible y único a partir del título ("Cody Rhodes vs. Gunther" → "cody-rhodes-vs-gunther"). */
async function uniqueId(title: string): Promise<string> {
  const base =
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'storyline';
  const rows = await (await db()).query<{ id: string }>('select id from app.storylines where id = $1 or id like $2', [base, `${base}-%`]);
  const taken = new Set(rows.map((r) => r.id));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createStoryline(draft: StorylineDraft, published = false): Promise<string> {
  const id = await uniqueId(draft.title);
  await (await db()).query(
    `insert into app.storylines (id, promotion, title, summary, participants, status, started_on, ended_on, related, published)
     values ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9::text[], $10)`,
    [id, draft.promotion, draft.title, draft.summary, draft.participants, draft.status, draft.startedOn ?? null, draft.endedOn ?? null, draft.related, published],
  );
  return id;
}

export async function addBeat(storylineId: string, beat: BeatDraft, status: 'pending' | 'approved' = 'pending'): Promise<void> {
  await (await db()).query(
    `insert into app.storyline_beats (storyline_id, date, show_id, show_name, title, text, kind, importance, source_url, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [storylineId, beat.date, beat.showId ?? null, beat.showName ?? null, beat.title, beat.text, beat.kind, beat.importance, beat.sourceUrl ?? null, status],
  );
}

/** Guarda cambios propuestos por la IA (se combinan con los que ya hubiera pendientes). */
export async function proposeChanges(storylineId: string, changes: NonNullable<AdminStoryline['pending']>): Promise<void> {
  await (await db()).query(
    `update app.storylines set pending = coalesce(pending, '{}'::jsonb) || $2::text::jsonb where id = $1`,
    [storylineId, JSON.stringify(changes)],
  );
}

// ---------------------------------------------------------------- Acciones de administración

export async function updateStoryline(id: string, fields: Partial<StorylineDraft>): Promise<void> {
  const map: Record<string, [string, unknown]> = {
    promotion: ['promotion', fields.promotion],
    title: ['title', fields.title],
    summary: ['summary', fields.summary],
    participants: ['participants', fields.participants],
    status: ['status', fields.status],
    startedOn: ['started_on', fields.startedOn],
    endedOn: ['ended_on', fields.endedOn],
    related: ['related', fields.related],
  };
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [key, [column, value]] of Object.entries(map)) {
    if (!(key in fields)) continue;
    params.push(value ?? null);
    const cast = column === 'participants' || column === 'related' ? '::text[]' : '';
    sets.push(`${column} = $${params.length}${cast}`);
  }
  if (!sets.length) return;
  await (await db()).query(`update app.storylines set ${sets.join(', ')}, updated_at = now() where id = $1`, params);
}

/** Publica una storyline propuesta junto con sus avances pendientes. */
export async function publishStoryline(id: string): Promise<void> {
  const q = await db();
  await q.query(`update app.storylines set published = true, updated_at = now() where id = $1`, [id]);
  await q.query(`update app.storyline_beats set status = 'approved' where storyline_id = $1 and status = 'pending'`, [id]);
}

export async function deleteStoryline(id: string): Promise<void> {
  await (await db()).query('delete from app.storylines where id = $1', [id]);
}

/** Acepta (o descarta) los cambios que propuso la IA para una storyline. */
export async function resolvePending(id: string, accept: boolean): Promise<void> {
  const q = await db();
  if (accept) {
    const [row] = await q.query<StoryRow>('select * from app.storylines where id = $1', [id]);
    const pending = row ? parsePending(row.pending) : null;
    if (pending) {
      await updateStoryline(id, {
        ...(pending.summary ? { summary: pending.summary } : {}),
        ...(pending.status ? { status: pending.status, ...(pending.status === 'closed' ? { endedOn: new Date().toISOString().slice(0, 10) } : {}) } : {}),
      });
    }
  }
  await q.query('update app.storylines set pending = null where id = $1', [id]);
}

export async function setBeatStatus(beatId: number, status: 'approved' | 'rejected'): Promise<void> {
  const q = await db();
  const [beat] = await q.query<{ storyline_id: string }>(
    'update app.storyline_beats set status = $2 where id = $1 returning storyline_id',
    [beatId, status],
  );
  // Un avance aprobado "mueve" la storyline arriba en la lista
  if (beat && status === 'approved') await q.query('update app.storylines set updated_at = now() where id = $1', [beat.storyline_id]);
}

export async function updateBeat(beatId: number, fields: Partial<Pick<BeatDraft, 'date' | 'title' | 'text' | 'kind' | 'importance'>>): Promise<void> {
  const columns = ['date', 'title', 'text', 'kind', 'importance'] as const;
  const sets: string[] = [];
  const params: unknown[] = [beatId];
  for (const c of columns) {
    if (fields[c] === undefined) continue;
    params.push(fields[c]);
    sets.push(`${c} = $${params.length}`);
  }
  if (sets.length) await (await db()).query(`update app.storyline_beats set ${sets.join(', ')} where id = $1`, params);
}

// ---------------------------------------------------------------- Shows procesados

export async function processedShows(): Promise<Set<string>> {
  const rows = await (await db()).query<{ show_id: string }>(`select show_id from app.storyline_jobs where status = 'done'`);
  return new Set(rows.map((r) => r.show_id));
}

export async function markJob(showId: string, sourceUrl: string, status: 'done' | 'error', detail?: string): Promise<void> {
  await (await db()).query(
    `insert into app.storyline_jobs (show_id, source_url, status, detail, processed_at) values ($1, $2, $3, $4, now())
     on conflict (show_id) do update set source_url = excluded.source_url, status = excluded.status,
       detail = excluded.detail, processed_at = now()`,
    [showId, sourceUrl, status, detail?.slice(0, 500) ?? null],
  );
}

export interface JobRow {
  show_id: string;
  source_url: string;
  status: string;
  detail: string | null;
  processed_at: Date;
}

export async function recentJobs(limit = 15): Promise<JobRow[]> {
  return (await db()).query<JobRow>('select * from app.storyline_jobs order by processed_at desc limit $1', [limit]);
}

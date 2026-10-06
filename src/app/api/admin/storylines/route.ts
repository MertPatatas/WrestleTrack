import { NextResponse, type NextRequest } from 'next/server';
import { BEAT_KINDS, type BeatKind, type PromotionId, type StorylineStatus } from '../../../../data/types';
import { requireAdmin } from '../../../../lib/server/admin';
import { errorResponse } from '../../../../lib/server/profile';
import { geminiConfigured } from '../../../../lib/storylines/gemini';
import { generateHistorical, processNextShow } from '../../../../lib/storylines/generate';
import {
  addBeat,
  createStoryline,
  deleteStoryline,
  listAll,
  publishStoryline,
  recentJobs,
  resolvePending,
  setBeatStatus,
  updateBeat,
  updateStoryline,
  type StorylineDraft,
} from '../../../../lib/storylines/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROMOTIONS: PromotionId[] = ['wwe', 'aew', 'cmll', 'aaa', 'njpw', 'other'];

// GET: todo lo necesario para la administración (storylines con lo pendiente y últimos procesados)
export async function GET() {
  const admin = await requireAdmin();
  if ('response' in admin) return admin.response;
  try {
    const [stories, jobs] = await Promise.all([listAll(), recentJobs()]);
    return NextResponse.json(
      {
        stories,
        jobs: jobs.map((j) => ({ showId: j.show_id, status: j.status, detail: j.detail, at: j.processed_at.toISOString() })),
        gemini: geminiConfigured(),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------- Validación de lo que llega

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const list = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => text(x, 80)).filter((x): x is string => Boolean(x)).slice(0, 20) : undefined;
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const id = (v: unknown) => (typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v) ? v : null);

function storyFields(v: unknown): Partial<StorylineDraft> {
  const f = (v ?? {}) as Record<string, unknown>;
  const out: Partial<StorylineDraft> = {};
  if (PROMOTIONS.includes(f.promotion as PromotionId)) out.promotion = f.promotion as PromotionId;
  if (text(f.title, 120)) out.title = text(f.title, 120);
  if (text(f.summary, 1500)) out.summary = text(f.summary, 1500);
  if (list(f.participants)) out.participants = list(f.participants);
  if (f.status === 'active' || f.status === 'closed') out.status = f.status as StorylineStatus;
  if ('startedOn' in f) out.startedOn = day(f.startedOn);
  if ('endedOn' in f) out.endedOn = day(f.endedOn);
  if (list(f.related)) out.related = list(f.related)!.filter((r) => id(r));
  return out;
}

function beatFields(v: unknown) {
  const f = (v ?? {}) as Record<string, unknown>;
  return {
    date: day(f.date),
    title: text(f.title, 120),
    text: text(f.text, 1200),
    kind: (BEAT_KINDS as readonly string[]).includes(f.kind as string) ? (f.kind as BeatKind) : undefined,
    importance: f.importance === 1 || f.importance === 2 || f.importance === 3 ? (f.importance as 1 | 2 | 3) : undefined,
  };
}

// POST { action, ... }: acciones de revisión y edición
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if ('response' in admin) return admin.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') return NextResponse.json({ error: 'Petición no válida' }, { status: 400 });
  const storyId = id(body.id);
  const beatId = Number.isInteger(body.beatId) ? (body.beatId as number) : null;
  const bad = () => NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

  try {
    switch (body.action) {
      case 'publish':
        if (!storyId) return bad();
        await publishStoryline(storyId);
        break;
      case 'delete':
        if (!storyId) return bad();
        await deleteStoryline(storyId);
        break;
      case 'update':
        if (!storyId) return bad();
        await updateStoryline(storyId, storyFields(body.fields));
        break;
      case 'pending':
        if (!storyId) return bad();
        await resolvePending(storyId, body.accept === true);
        break;
      case 'beatStatus':
        if (beatId === null || (body.status !== 'approved' && body.status !== 'rejected')) return bad();
        await setBeatStatus(beatId, body.status);
        break;
      case 'editBeat':
        if (beatId === null) return bad();
        await updateBeat(beatId, beatFields(body.fields));
        break;
      case 'addBeat': {
        const b = beatFields(body.fields);
        if (!storyId || !b.date || !b.title || !b.text) return bad();
        await addBeat(storyId, { ...b, date: b.date, title: b.title, text: b.text, kind: b.kind ?? 'other', importance: b.importance ?? 2 }, 'approved');
        break;
      }
      case 'create': {
        const f = storyFields(body.fields);
        if (!f.title || !f.summary || !f.promotion) return bad();
        const created = await createStoryline(
          { promotion: f.promotion, title: f.title, summary: f.summary, participants: f.participants ?? [], status: f.status ?? 'active', startedOn: f.startedOn, endedOn: f.endedOn, related: f.related ?? [] },
          true,
        );
        return NextResponse.json({ ok: true, id: created });
      }
      case 'process':
        return NextResponse.json({ ok: true, result: await processNextShow({ retryErrors: true }) });
      case 'historical': {
        const topic = text(body.topic, 120);
        const url = text(body.url, 300);
        if (!topic) return bad();
        if (url && !/^https:\/\/en\.wikipedia\.org\/wiki\/[^?#]+$/.test(url)) {
          return NextResponse.json({ error: 'El enlace tiene que ser de en.wikipedia.org/wiki/…' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, result: await generateHistorical(topic, url || undefined) });
      }
      default:
        return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Los fallos de Gemini o Wikipedia se muestran tal cual al administrador
    if (body.action === 'historical' || body.action === 'process') {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
    return errorResponse(err);
  }
}

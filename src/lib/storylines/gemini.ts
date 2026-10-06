import 'server-only';

// GEMINI (Google AI Studio, nivel gratuito): redacta los borradores de las storylines.
// Variables: GEMINI_API_KEY (obligatoria) y GEMINI_MODEL (opcional). Si el modelo indicado no
// existe (Google los renueva a menudo), se elige el "flash" más reciente disponible.

const API = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 50_000;

let resolvedModel: string | null = null;

export class GeminiError extends Error {}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

const headers = () => ({ 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY!.trim() });

/** El "flash" estable más reciente que admite generateContent. */
async function pickFlashModel(): Promise<string> {
  const res = await fetch(`${API}/models?pageSize=200`, { headers: headers(), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new GeminiError(`No se pudo listar los modelos (HTTP ${res.status})`);
  const { models = [] } = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const candidates = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/lite|image|tts|audio|live|embedding|exp|preview/.test(n));
  // "gemini-3.8-flash" > "gemini-2.5-flash": se ordena por la versión del nombre
  const version = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  candidates.sort((a, b) => version(b) - version(a) || a.length - b.length);
  if (!candidates.length) throw new GeminiError('No hay ningún modelo "flash" disponible para esta clave');
  return candidates[0];
}

async function generate(model: string, prompt: string, system: string): Promise<Response> {
  return fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: headers(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  });
}

/** Pide a Gemini una respuesta en JSON y la devuelve ya interpretada (sin validar: lo hace quien llama). */
export async function askGeminiJson(prompt: string, system: string): Promise<unknown> {
  if (!geminiConfigured()) throw new GeminiError('Falta GEMINI_API_KEY');
  let model = resolvedModel ?? process.env.GEMINI_MODEL?.trim() ?? DEFAULT_MODEL;
  let res = await generate(model, prompt, system);
  if (res.status === 404 || res.status === 400) {
    // Modelo inexistente o retirado: se busca otro una vez
    const body = await res.text();
    if (res.status === 400 && !/model/i.test(body)) throw new GeminiError(`Gemini HTTP 400: ${body.slice(0, 300)}`);
    model = await pickFlashModel();
    res = await generate(model, prompt, system);
  }
  if (res.status === 429) throw new GeminiError('Gemini: límite del nivel gratuito alcanzado, se reintentará más tarde');
  if (!res.ok) throw new GeminiError(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  resolvedModel = model;

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) throw new GeminiError(`Gemini bloqueó la petición (${data.promptFeedback.blockReason})`);
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) throw new GeminiError(`Gemini no devolvió texto (${data.candidates?.[0]?.finishReason ?? 'sin motivo'})`);
  try {
    // Por si lo envuelve en un bloque de código
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new GeminiError('Gemini devolvió un JSON no válido');
  }
}

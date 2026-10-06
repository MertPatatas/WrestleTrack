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

/**
 * Otro modelo "flash" que admita generateContent, el más reciente primero, sin repetir los ya
 * probados. Los "lite" solo como último recurso (si los normales están saturados).
 */
async function pickFlashModel(exclude: Set<string>): Promise<string | null> {
  const res = await fetch(`${API}/models?pageSize=200`, { headers: headers(), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new GeminiError(`No se pudo listar los modelos (HTTP ${res.status})`);
  const { models = [] } = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const names = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/image|tts|audio|live|embedding|exp|preview/.test(n) && !exclude.has(n));
  // "gemini-3.8-flash" > "gemini-2.5-flash": se ordena por la versión del nombre, los "lite" al final
  const version = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  names.sort((a, b) => Number(/lite/.test(a)) - Number(/lite/.test(b)) || version(b) - version(a) || a.length - b.length);
  return names[0] ?? null;
}

async function generate(model: string, prompt: string, system: string, timeoutMs: number): Promise<Response> {
  return fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: headers(),
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pide a Gemini una respuesta en JSON y la devuelve ya interpretada (sin validar: lo hace quien llama). */
export async function askGeminiJson(prompt: string, system: string): Promise<unknown> {
  if (!geminiConfigured()) throw new GeminiError('Falta GEMINI_API_KEY');
  // Todo tiene que caber en el minuto que dura como mucho una petición al servidor
  const deadline = Date.now() + TIMEOUT_MS;
  const preferred = resolvedModel ?? process.env.GEMINI_MODEL?.trim() ?? DEFAULT_MODEL;
  const tried = new Set<string>();
  let model: string | null = preferred;
  let res: Response | null = null;
  let lastError = '';
  let preferredMissing = false;

  for (let attempt = 0; attempt < 5 && model; attempt++) {
    const left = deadline - Date.now();
    if (left < 8000) break;
    tried.add(model);
    try {
      res = await generate(model, prompt, system, left);
    } catch {
      lastError = `${model}: sin respuesta a tiempo`;
      res = null;
      model = await pickFlashModel(tried).catch(() => null);
      continue;
    }
    if (res.ok) break;

    const body = await res.text();
    lastError = `${model}: HTTP ${res.status}`;
    if (res.status === 429) throw new GeminiError('Gemini: límite del nivel gratuito alcanzado. Se reintentará más tarde.');
    if (res.status === 404 || (res.status === 400 && /model/i.test(body))) {
      // Modelo inexistente o retirado: otro
      if (model === preferred) preferredMissing = true;
      model = await pickFlashModel(tried);
    } else if (res.status >= 500) {
      // Saturado o fallo temporal: una espera corta y el mismo modelo; si vuelve a fallar, otro
      if (attempt === 0) {
        tried.delete(model);
        await sleep(3000);
      } else {
        model = await pickFlashModel(tried).catch(() => null);
      }
    } else {
      throw new GeminiError(`Gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    res = null;
  }
  if (!res?.ok) {
    throw new GeminiError(`Gemini está saturado o no responde ahora mismo (${lastError || 'sin modelos disponibles'}). Prueba de nuevo en unos minutos.`);
  }
  // Se recuerda solo si el preferido no existe (si estaba saturado, la próxima vez se vuelve a probar)
  if (preferredMissing && model) resolvedModel = model;

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

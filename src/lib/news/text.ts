const CDATA = /<!\[CDATA\[([\s\S]*?)\]\]>/g;

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ',
  iexcl: '¡', iquest: '¿', copy: '©',
};

export function stripCdata(s: string): string {
  return s.replace(CDATA, '$1');
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED[entity] ?? NAMED[entity.toLowerCase()] ?? match;
  });
}

export function stripHtml(s: string): string {
  return s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(br|p|div|li)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '');
}

// Texto plano: quita CDATA, decodifica entidades, elimina HTML y normaliza espacios.
export function cleanText(raw: string): string {
  const decoded = decodeEntities(stripCdata(raw));
  return decodeEntities(stripHtml(decoded)).replace(/\s+/g, ' ').trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return base.replace(/[\s,;:.\-–—]+$/, '') + '…';
}

// Extracto corto: sin restos típicos de WordPress ("The post ... appeared first on ...").
export function cleanExcerpt(raw: string, max = 220): string {
  let text = cleanText(raw);
  text = text.replace(/\s*The post .{0,200}? appeared first on .{0,100}$/i, '');
  text = text.replace(/\s*(Read more|Leer más|Continue reading)\b[^.]{0,40}$/i, '');
  text = text.replace(/\s*(\[…\]|\[\.\.\.\]|…)\s*$/, '…');
  return truncate(text.trim(), max);
}

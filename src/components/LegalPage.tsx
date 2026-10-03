import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Lang } from '../i18n/config';
import { translate } from '../i18n/messages';
import { LEGAL_UPDATED, type LegalDoc } from '../legal/content';
import { Wordmark } from './Wordmark';

// Convierte las direcciones web y emails del texto en enlaces
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+[^\s).,]|www\.[^\s)]+[^\s).,]|[\w.+-]+@[\w-]+\.[\w.]+[\w])/g).map((part, i) => {
    if (/^https?:\/\//.test(part)) return <a key={i} className="link link--inline" href={part} target="_blank" rel="noopener noreferrer">{part}</a>;
    if (/^www\./.test(part)) return <a key={i} className="link link--inline" href={`https://${part}`} target="_blank" rel="noopener noreferrer">{part}</a>;
    if (/@/.test(part)) return <a key={i} className="link link--inline" href={`mailto:${part}`}>{part}</a>;
    return part;
  });
}

export function LegalPage({ doc, lang }: { doc: LegalDoc; lang: Lang }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const updated = new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <article className="legal">
      <div className="legal-top">
        <Wordmark />
        <Link href="/" className="link">
          ← {t('legal.back')}
        </Link>
      </div>
      <h1 className="page-title">{doc.title}</h1>
      <p className="muted small">{translate(lang, 'legal.updated', { date: updated })}</p>
      <p className="legal-intro">{linkify(doc.intro)}</p>
      {doc.sections.map((s) => (
        <section key={s.title} className="legal-section">
          <h2>{s.title}</h2>
          {s.paragraphs?.map((p, i) => <p key={`p${i}`}>{linkify(p)}</p>)}
          {s.list ? (
            <ul>
              {s.list.map((item, i) => (
                <li key={i}>{linkify(item)}</li>
              ))}
            </ul>
          ) : null}
          {s.note?.map((p, i) => <p key={`n${i}`}>{linkify(p)}</p>)}
        </section>
      ))}
      <p className="legal-links small">
        <Link href="/privacidad" className="link link--inline">
          {t('legal.privacy')}
        </Link>
        {' · '}
        <Link href="/condiciones" className="link link--inline">
          {t('legal.terms')}
        </Link>
      </p>
    </article>
  );
}

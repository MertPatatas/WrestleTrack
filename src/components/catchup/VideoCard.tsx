'use client';

import { useState } from 'react';
import type { AnalysisVideo } from '../../data/types';
import { useT } from '../../i18n/SettingsProvider';
import type { Formatter } from '../../lib/dates';

// Vídeo de YouTube: miniatura que, al pulsarla, se convierte en el reproductor
// (youtube-nocookie: no deja cookies hasta que se reproduce)
export function VideoCard({ video, fmt, now }: { video: AnalysisVideo; fmt: Formatter; now: number }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const watchUrl = `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <article className="video-card">
      <div className="video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button type="button" className="video-thumb" onClick={() => setPlaying(true)} aria-label={t('catchup.play', { title: video.title })}>
            <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" loading="lazy" />
            <span className="video-play" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <div className="video-info">
        <a className="video-title" href={watchUrl} target="_blank" rel="noopener noreferrer">
          {video.title}
        </a>
        <p className="muted small">
          {video.channel} · <span className="video-lang">{video.lang.toUpperCase()}</span> · {fmt.timeAgo(video.publishedAt, now)}
        </p>
      </div>
    </article>
  );
}

'use client';

import { useRef, type MouseEvent, type ReactNode } from 'react';

const DURATION = 260;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * <details> que se abre y se cierra deslizando en cualquier navegador: anima la altura con la
 * Web Animations API (el CSS para animar hasta "auto" solo lo admiten Chrome y Edge).
 */
export function AnimatedDetails({ className, summary, children }: { className?: string; summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const running = useRef<Animation | null>(null);

  const toggle = (e: MouseEvent) => {
    const el = ref.current;
    // Sin animaciones (o si el usuario prefiere menos movimiento): comportamiento normal
    if (!el || typeof el.animate !== 'function' || reducedMotion()) return;
    e.preventDefault();
    const from = el.offsetHeight;
    const opening = !el.open || el.dataset.closing === 'true';

    running.current?.cancel();
    el.style.overflow = 'hidden';
    let to: number;
    if (opening) {
      delete el.dataset.closing;
      el.open = true;
      to = el.offsetHeight; // altura natural ya abierto
    } else {
      // data-closing quita ya los estilos de "abierto" de la cabecera, para medir la altura final
      el.dataset.closing = 'true';
      const style = getComputedStyle(el);
      const frame = el.offsetHeight - el.clientHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      to = (el.querySelector('summary')?.offsetHeight ?? 0) + frame;
    }

    el.querySelector('.details-body')?.animate({ opacity: opening ? [0, 1] : [1, 0] }, { duration: DURATION, easing: EASING });
    const anim = el.animate({ height: [`${from}px`, `${to}px`] }, { duration: DURATION, easing: EASING });
    running.current = anim;
    anim.onfinish = () => {
      if (!opening) el.open = false;
      delete el.dataset.closing;
      el.style.overflow = '';
      running.current = null;
    };
    anim.oncancel = () => {
      el.style.overflow = '';
    };
  };

  return (
    <details ref={ref} className={className}>
      <summary onClick={toggle}>{summary}</summary>
      <div className="details-body">{children}</div>
    </details>
  );
}

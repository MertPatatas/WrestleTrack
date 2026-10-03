import type { PromotionId } from '../data/types';

// Logo de cada promoción.
// WWE, AEW y AAA: logotipos de dominio público (Wikimedia Commons), en public/logos.
// CMLL y NJPW no tienen logo libre: se muestra un rótulo tipográfico con sus colores.
// Las marcas pertenecen a sus propietarios; aquí solo identifican cada promoción.

const IMAGE_LOGOS: Partial<Record<PromotionId, { src: string; ratio: number }>> = {
  wwe: { src: '/logos/wwe.svg', ratio: 219 / 200 },
  aew: { src: '/logos/aew.svg', ratio: 180 / 64.8 },
  aaa: { src: '/logos/aaa.png', ratio: 1000 / 616 },
};

const NAMES: Record<PromotionId, string> = {
  wwe: 'WWE',
  aew: 'AEW',
  cmll: 'CMLL',
  aaa: 'AAA',
  njpw: 'NJPW',
  other: 'General',
};

export function PromoLogo({ id, height = 18, label }: { id: PromotionId; height?: number; label?: string }) {
  const image = IMAGE_LOGOS[id];
  const alt = label ?? NAMES[id];
  if (image) {
    return (
      <img
        className="promo-logo"
        src={image.src}
        alt={alt}
        height={height}
        width={Math.round(height * image.ratio)}
        style={{ height, width: 'auto' }}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span className={`promo-wordmark promo-wordmark--${id}`} style={{ fontSize: Math.round(height * 0.95) }} aria-label={alt}>
      {id === 'other' ? alt : NAMES[id]}
    </span>
  );
}

import type { BrandId } from '../data/brands';

// Logo de cada promoción o marca (Raw, SmackDown y NXT dentro de WWE), en public/logos.
// WWE, AEW y AAA vienen de Wikimedia Commons; el resto, recortados y reducidos a 160 px de alto.
// Las marcas pertenecen a sus propietarios; aquí solo identifican cada promoción.

// scale: los logos redondos o con mucho detalle se ven más grandes para que se reconozcan a tamaño pequeño
const IMAGE_LOGOS: Partial<Record<BrandId, { src: string; ratio: number; scale?: number }>> = {
  wwe: { src: '/logos/wwe.svg', ratio: 219 / 200 },
  raw: { src: '/logos/raw.webp', ratio: 295 / 160, scale: 1.3 },
  smackdown: { src: '/logos/smackdown.webp', ratio: 195 / 160, scale: 1.15 },
  nxt: { src: '/logos/nxt.webp', ratio: 427 / 160 },
  aew: { src: '/logos/aew.svg', ratio: 180 / 64.8 },
  aaa: { src: '/logos/aaa.png', ratio: 1000 / 616 },
  cmll: { src: '/logos/cmll.webp', ratio: 290 / 135, scale: 1.35 },
  njpw: { src: '/logos/njpw.webp', ratio: 161 / 160, scale: 1.45 },
};

const NAMES: Record<BrandId, string> = {
  wwe: 'WWE',
  raw: 'WWE Raw',
  smackdown: 'WWE SmackDown',
  nxt: 'WWE NXT',
  aew: 'AEW',
  cmll: 'CMLL',
  aaa: 'AAA',
  njpw: 'NJPW',
  other: 'General',
};

export function PromoLogo({ id, height = 18, label }: { id: BrandId; height?: number; label?: string }) {
  const image = IMAGE_LOGOS[id];
  const alt = label ?? NAMES[id];
  if (image) {
    const h = Math.round(height * (image.scale ?? 1));
    return (
      <img
        className={`promo-logo promo-logo--${id}`}
        src={image.src}
        alt={alt}
        height={h}
        width={Math.round(h * image.ratio)}
        style={{ height: h, width: 'auto' }}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span className={`promo-wordmark promo-wordmark--${id}`} style={{ fontSize: Math.round(height * 0.95) }} aria-label={alt}>
      {alt}
    </span>
  );
}

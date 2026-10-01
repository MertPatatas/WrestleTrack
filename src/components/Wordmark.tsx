import Link from 'next/link';

// Marca (anillo + W) y rótulo, a partir de los PNG de public/brand.
export function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <Link
      href="/"
      className={large ? 'wordmark wordmark--large' : 'wordmark'}
      aria-label="WrestleTrack, inicio"
    >
      <img className="wordmark-mark" src="/brand/logo-mark.png" alt="" />
      <img className="wordmark-text" src="/brand/logo-text.png" alt="" />
    </Link>
  );
}

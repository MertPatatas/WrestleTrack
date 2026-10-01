import Link from 'next/link';
import { Logo } from './Logo';

export function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <Link href="/" className={large ? 'wordmark wordmark--large' : 'wordmark'} aria-label="WrestleTrack, inicio">
      <Logo size={large ? 34 : 28} />
      <span>
        <span className="wm-a">Wrestle</span>
        <span className="wm-b">Track</span>
      </span>
    </Link>
  );
}

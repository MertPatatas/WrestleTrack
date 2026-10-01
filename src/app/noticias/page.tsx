import type { Metadata } from 'next';
import { NewsView } from '../../views/NewsView';

export const metadata: Metadata = { title: 'Noticias' };

export default function Page() {
  return <NewsView />;
}

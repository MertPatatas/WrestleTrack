import type { Metadata } from 'next';
import { StorylinesView } from '../../views/StorylinesView';

export const metadata: Metadata = { title: 'Storylines' };

export default function Page() {
  return <StorylinesView />;
}

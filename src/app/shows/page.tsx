import type { Metadata } from 'next';
import { ShowsView } from '../../views/ShowsView';

export const metadata: Metadata = { title: 'Shows' };

export default function Page() {
  return <ShowsView />;
}

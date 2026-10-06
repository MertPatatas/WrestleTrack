import type { Metadata } from 'next';
import { AdminView } from '../../views/AdminView';

// Herramienta interna: fuera de los buscadores
export const metadata: Metadata = { title: 'Administración', robots: { index: false, follow: false } };

export default function Page() {
  return <AdminView />;
}

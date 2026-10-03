import { pageTitle } from '../../../i18n/server';
import { ShowDetailView } from '../../../views/ShowDetailView';

export const generateMetadata = () => pageTitle('nav.shows');

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShowDetailView id={decodeURIComponent(id)} />;
}

import { pageTitle } from '../../../i18n/server';
import { StorylineView } from '../../../views/StorylineView';

export const generateMetadata = () => pageTitle('storylines.title');

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StorylineView id={decodeURIComponent(id)} />;
}

import { pageTitle } from '../../i18n/server';
import { StorylinesView } from '../../views/StorylinesView';

export const generateMetadata = () => pageTitle('storylines.title');

export default function Page() {
  return <StorylinesView />;
}

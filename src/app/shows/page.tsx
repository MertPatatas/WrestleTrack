import { pageTitle } from '../../i18n/server';
import { ShowsView } from '../../views/ShowsView';

export const generateMetadata = () => pageTitle('nav.shows');

export default function Page() {
  return <ShowsView />;
}

import { pageTitle } from '../../i18n/server';
import { NewsView } from '../../views/NewsView';

export const generateMetadata = () => pageTitle('news.title');

export default function Page() {
  return <NewsView />;
}

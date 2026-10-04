import { pageTitle } from '../../i18n/server';
import { CATCHUP_TABS, type CatchUpTab } from '../../data/catchup';
import { CatchUpView } from '../../views/CatchUpView';

export const generateMetadata = () => pageTitle('catchup.title');

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const initial = CATCHUP_TABS.find((id) => id === tab) ?? 'resumenes';
  return <CatchUpView initialTab={initial as CatchUpTab} />;
}

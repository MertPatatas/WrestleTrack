import { LegalPage } from '../../components/LegalPage';
import { getRequestI18n, pageTitle } from '../../i18n/server';
import { privacyPolicy } from '../../legal/content';

export const generateMetadata = () => pageTitle('legal.privacy');

export default async function Page() {
  const { lang } = await getRequestI18n();
  return <LegalPage doc={privacyPolicy(lang)} lang={lang} />;
}

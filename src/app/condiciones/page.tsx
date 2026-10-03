import { LegalPage } from '../../components/LegalPage';
import { getRequestI18n, pageTitle } from '../../i18n/server';
import { termsOfService } from '../../legal/content';

export const generateMetadata = () => pageTitle('legal.terms');

export default async function Page() {
  const { lang } = await getRequestI18n();
  return <LegalPage doc={termsOfService(lang)} lang={lang} />;
}

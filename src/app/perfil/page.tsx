import { pageTitle } from '../../i18n/server';
import { ProfileView } from '../../views/ProfileView';

export const generateMetadata = () => pageTitle('profile.title');

export default function Page() {
  return <ProfileView />;
}

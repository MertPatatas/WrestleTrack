import { redirect } from 'next/navigation';

// Las storylines ahora son una pestaña de "Ponme al día"
export default function Page() {
  redirect('/al-dia?tab=storylines');
}

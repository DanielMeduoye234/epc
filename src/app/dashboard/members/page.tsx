import { redirect } from 'next/navigation';

// The "All Individuals" page was retired — Regular Members is now the single
// source of truth for membership. Keep the route alive for old links.
export default function MembersPage() {
  redirect('/dashboard/regular-members');
}

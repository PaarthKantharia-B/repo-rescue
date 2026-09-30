import { redirect } from 'next/navigation';

interface PageProps {
  params: { username: string };
}

/**
 * Public Contributor Profile Redirect:
 * Preserves clean boundary: /contributions is strictly for the authenticated personal dashboard.
 * Public profiles requested via /contributions/[username] redirect to /profile/[username].
 */
export default async function PublicContributorRedirect({ params }: PageProps) {
  redirect(`/profile/${params.username}`);
}

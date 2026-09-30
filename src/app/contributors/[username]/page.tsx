import { redirect } from 'next/navigation';

interface PageProps {
  params: { username: string };
}

/**
 * Public Contributor Route Alias:
 * Redirects /contributors/[username] to /profile/[username] for public profile viewing.
 */
export default async function PublicContributorsAliasPage({ params }: PageProps) {
  redirect(`/profile/${params.username}`);
}

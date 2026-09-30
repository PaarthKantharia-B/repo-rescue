import { redirect } from 'next/navigation';

interface ProfilePageProps {
  params: { username: string };
}

export default async function LegacyProfileRedirect({ params }: ProfilePageProps) {
  redirect(`/contributors/${params.username}`);
}

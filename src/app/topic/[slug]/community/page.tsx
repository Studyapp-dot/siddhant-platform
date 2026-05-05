import { redirect } from 'next/navigation';

export default async function CommunityRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/topic/${slug}/discussion`);
}

import React from 'react';
import { notFound } from 'next/navigation';
import EditPageContent from '../edit/EditPageContent';
import '../edit/edit.css';

export default async function TopicUtilityPage({
  params,
}: {
  params: Promise<{ slug: string; view: string }>;
}) {
  const { slug, view } = await params;

  if (view !== 'edit') {
    notFound();
  }

  return <EditPageContent slug={slug} />;
}

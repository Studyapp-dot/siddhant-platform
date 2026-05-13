import React from 'react';
import EditPageContent from './EditPageContent';
import './edit.css';

export default async function EditNodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EditPageContent slug={slug} />;
}

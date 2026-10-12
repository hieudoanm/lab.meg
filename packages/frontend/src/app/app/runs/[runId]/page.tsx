import type { Metadata } from 'next';

import { RunDetailView } from './run-detail-view';

export const metadata: Metadata = { title: 'Run' };

const RunDetailPage = async ({ params }: { params: Promise<{ runId: string }> }) => {
  const { runId } = await params;
  return <RunDetailView runId={runId} />;
};

export default RunDetailPage;

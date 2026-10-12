import type { Metadata } from 'next';

import { PipelineDetailView } from './pipeline-detail-view';

export const metadata: Metadata = { title: 'Pipeline' };

const PipelineDetailPage = async ({ params }: { params: Promise<{ pipelineId: string }> }) => {
  const { pipelineId } = await params;
  return <PipelineDetailView pipelineId={pipelineId} />;
};

export default PipelineDetailPage;

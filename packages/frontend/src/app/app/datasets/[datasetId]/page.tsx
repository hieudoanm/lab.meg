import type { Metadata } from 'next';

import { DatasetDetailView } from './dataset-detail-view';

export const metadata: Metadata = { title: 'Dataset' };

const DatasetDetailPage = async ({ params }: { params: Promise<{ datasetId: string }> }) => {
  const { datasetId } = await params;
  return <DatasetDetailView datasetId={datasetId} />;
};

export default DatasetDetailPage;

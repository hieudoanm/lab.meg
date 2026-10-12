import type { Metadata } from 'next';

import { ViewerView } from './viewer-view';

export const metadata: Metadata = { title: 'Signal Viewer' };

const DatasetViewerPage = async ({ params }: { params: Promise<{ datasetId: string }> }) => {
  const { datasetId } = await params;
  return <ViewerView datasetId={datasetId} />;
};

export default DatasetViewerPage;

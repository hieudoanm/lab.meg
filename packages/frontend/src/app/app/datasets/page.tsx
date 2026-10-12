import type { Metadata } from 'next';

import { DatasetsView } from './datasets-view';

export const metadata: Metadata = { title: 'Datasets' };

const DatasetsPage = () => {
  return <DatasetsView />;
};

export default DatasetsPage;

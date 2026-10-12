import type { Metadata } from 'next';

import { NewDatasetView } from './new-dataset-view';

export const metadata: Metadata = { title: 'Upload dataset' };

const NewDatasetPage = () => {
  return <NewDatasetView />;
};

export default NewDatasetPage;

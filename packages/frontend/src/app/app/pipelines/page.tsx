import type { Metadata } from 'next';

import { PipelinesView } from './pipelines-view';

export const metadata: Metadata = { title: 'Pipelines' };

const PipelinesPage = () => {
  return <PipelinesView />;
};

export default PipelinesPage;

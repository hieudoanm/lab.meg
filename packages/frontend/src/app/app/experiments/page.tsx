import type { Metadata } from 'next';

import { ExperimentsView } from './experiments-view';

export const metadata: Metadata = { title: 'Experiments' };

const ExperimentsPage = () => {
  return <ExperimentsView />;
};

export default ExperimentsPage;

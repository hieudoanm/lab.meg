import type { Metadata } from 'next';

import { NotebooksView } from './notebooks-view';

export const metadata: Metadata = { title: 'Notebooks' };

const NotebooksPage = () => {
  return <NotebooksView />;
};

export default NotebooksPage;

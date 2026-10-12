import type { Metadata } from 'next';

import { NewProjectView } from './new-project-view';

export const metadata: Metadata = { title: 'New project' };

const NewProjectPage = () => {
  return <NewProjectView />;
};

export default NewProjectPage;

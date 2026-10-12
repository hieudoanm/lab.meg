import type { Metadata } from 'next';

import { ProjectsView } from './projects-view';

export const metadata: Metadata = { title: 'Projects' };

const ProjectsPage = () => {
  return <ProjectsView />;
};

export default ProjectsPage;

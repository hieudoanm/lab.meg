import type { Metadata } from 'next';

import { ProjectDetailView } from './project-detail-view';

export const metadata: Metadata = { title: 'Project' };

const ProjectDetailPage = async ({ params }: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await params;
  return <ProjectDetailView projectId={projectId} />;
};

export default ProjectDetailPage;

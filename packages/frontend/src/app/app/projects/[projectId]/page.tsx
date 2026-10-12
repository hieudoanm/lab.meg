import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Project' };

const ProjectDetailPage = async ({ params }: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await params;
  return (
    <div>
      <h1>Project Detail: {projectId}</h1>
      <p>This is a test page for project {projectId}</p>
    </div>
  );
};

export default ProjectDetailPage;

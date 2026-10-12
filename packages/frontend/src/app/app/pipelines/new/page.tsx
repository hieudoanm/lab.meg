import type { Metadata } from 'next';

import { NewPipelineView } from './new-pipeline-view';

export const metadata: Metadata = { title: 'New pipeline' };

export default function NewPipelinePage() {
  return <NewPipelineView />;
}

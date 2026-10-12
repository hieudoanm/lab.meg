import type { Metadata } from 'next';

import { SignalViewerView } from './signal-viewer-view';

export const metadata: Metadata = { title: 'Signal Viewer' };

const SignalViewerPage = () => {
  return <SignalViewerView />;
};

export default SignalViewerPage;

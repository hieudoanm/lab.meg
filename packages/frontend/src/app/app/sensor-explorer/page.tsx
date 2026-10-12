import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SensorExplorerView } from './sensor-explorer-view';

export const metadata: Metadata = { title: 'Sensor Explorer' };

const SensorExplorerPage = () => {
  return (
    <Suspense>
      <SensorExplorerView />
    </Suspense>
  );
};

export default SensorExplorerPage;

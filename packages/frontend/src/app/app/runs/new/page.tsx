import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoadingState } from '@/components/atoms/states';

import { NewRunView } from './new-run-view';

export const metadata: Metadata = { title: 'New run' };

const NewRunPage = () => {
  return (
    <Suspense fallback={<LoadingState label='Loading run form…' />}>
      <NewRunView />
    </Suspense>
  );
};

export default NewRunPage;

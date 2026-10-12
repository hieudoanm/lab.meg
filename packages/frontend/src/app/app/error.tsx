'use client';

import { Button } from '@/components/atoms/button';
import { ErrorState } from '@/components/atoms/states';

const AppError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
  return (
    <ErrorState
      title='This page could not be loaded'
      message={error.message || 'An unexpected error occurred while loading this page.'}
      requestId={error.digest ?? null}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
};

export default AppError;

'use client';

const RootError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
  return (
    <main className='bg-background flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center'>
      <h1 className='text-text-primary text-2xl font-semibold'>Something went wrong</h1>
      <p className='text-text-secondary max-w-md text-sm'>
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {error.digest ? (
        <p className='text-text-muted font-mono text-xs'>Request ID: {error.digest}</p>
      ) : null}
      <button type='button' onClick={reset} className='btn btn-primary btn-sm mt-2'>
        Try again
      </button>
    </main>
  );
};

export default RootError;

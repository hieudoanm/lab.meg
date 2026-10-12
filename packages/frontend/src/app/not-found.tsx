import Link from 'next/link';

const NotFound = () => {
  return (
    <main className='bg-background flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center'>
      <p className='text-accent font-mono text-sm'>404</p>
      <h1 className='text-text-primary text-2xl font-semibold'>Page not found</h1>
      <p className='text-text-secondary max-w-md text-sm'>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href='/app' className='btn btn-primary btn-sm mt-2'>
        Back to workspace
      </Link>
    </main>
  );
};

export default NotFound;

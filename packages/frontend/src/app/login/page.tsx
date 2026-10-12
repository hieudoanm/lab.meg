import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { LoadingState } from '@/components/atoms/states';
import { LoginForm } from '@/components/molecules/login-form';

export const metadata: Metadata = { title: 'Sign in' };

const LoginPage = () => {
  return (
    <main className='bg-background flex min-h-screen items-center justify-center px-4 py-12'>
      <div className='w-full max-w-sm'>
        <Link href='/' className='mb-6 flex items-center gap-2.5'>
          <span
            aria-hidden='true'
            className='bg-accent text-background flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold'>
            M
          </span>
          <span className='text-text-primary text-[15px] font-semibold tracking-tight'>
            MEG Lab
          </span>
        </Link>

        <div className='border-border bg-surface rounded-xl border p-6 shadow-[var(--shadow-elevation-3)]'>
          <h1 className='text-text-primary text-xl font-semibold'>Sign in</h1>
          <p className='text-text-secondary mt-1 text-sm'>
            Welcome back. Continue to your research workspace.
          </p>

          <Suspense fallback={<LoadingState label='Loading sign-in…' />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className='text-text-muted mt-4 text-center text-xs'>
          Private by default. Recordings and derived files are visible only to you and the members
          you add.
        </p>
      </div>
    </main>
  );
};

export default LoginPage;

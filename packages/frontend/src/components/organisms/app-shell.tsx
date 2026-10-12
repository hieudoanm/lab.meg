import type { ReactNode } from 'react';

import { Sidebar } from '@/components/molecules/sidebar';

export interface AppShellProps {
  topBar: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}

export const AppShell = ({ topBar, children, fullWidth = false }: AppShellProps) => {
  return (
    <div className='flex min-h-screen'>
      <a
        href='#main-content'
        className='focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:shadow'>
        Skip to main content
      </a>
      <Sidebar />
      <div className='flex min-w-0 flex-1 flex-col'>
        {topBar}
        <main
          id='main-content'
          className={
            fullWidth ? 'flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8'
          }>
          {children}
        </main>
      </div>
    </div>
  );
};

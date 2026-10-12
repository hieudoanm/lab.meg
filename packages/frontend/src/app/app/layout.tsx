import { Suspense } from 'react';

import { TopBar } from '@/components/molecules/top-bar';
import { AppShell } from '@/components/organisms/app-shell';
import { getSessionUserHint } from '@/lib/session';

const SessionTopBar = async () => {
  const user = await getSessionUserHint();
  return <TopBar userName={user?.displayName ?? user?.email ?? 'Account'} />;
};

const TopBarFallback = () => {
  return (
    <header
      aria-hidden='true'
      className='border-border bg-surface/95 sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b px-4 backdrop-blur sm:px-6'>
      <span className='bg-surface-muted h-8 w-56 animate-pulse rounded' />
      <span className='bg-surface-muted h-8 w-32 animate-pulse rounded' />
    </header>
  );
};

const AppLayout = ({ children }: LayoutProps<'/app'>) => {
  return (
    <AppShell
      topBar={
        <Suspense fallback={<TopBarFallback />}>
          <SessionTopBar />
        </Suspense>
      }>
      {children}
    </AppShell>
  );
};

export default AppLayout;

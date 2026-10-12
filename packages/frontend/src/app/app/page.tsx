import type { Metadata } from 'next';

import { getSessionUserHint } from '@/lib/session';

import { HomeView } from './home-view';

export const metadata: Metadata = { title: 'Home' };

const HomePage = async () => {
  const user = await getSessionUserHint();
  const userName = user?.displayName ?? user?.email ?? 'there';
  return <HomeView userName={userName} />;
};

export default HomePage;

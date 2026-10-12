import type { Metadata } from 'next';

import { ExploreView } from './explore-view';

export const metadata: Metadata = { title: 'Explore' };

const ExplorePage = () => {
  return <ExploreView />;
};

export default ExplorePage;

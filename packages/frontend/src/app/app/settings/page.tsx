import type { Metadata } from 'next';

import { SettingsView } from './settings-view';

export const metadata: Metadata = { title: 'Settings' };

const SettingsPage = () => {
  return <SettingsView />;
};

export default SettingsPage;

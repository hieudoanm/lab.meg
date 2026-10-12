import type { Metadata, Viewport } from 'next';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'MEG Lab',
    template: '%s · MEG Lab',
  },
  description:
    'MEG Lab is a cloud computational electrophysiology workbench for managing MEG recordings, running reproducible analysis pipelines, and sharing traceable results.',
  metadataBase: new URL('https://meg-lab.example.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://meg-lab.example.com',
    siteName: 'MEG Lab',
    title: 'MEG Lab — Computational Electrophysiology Workbench',
    description:
      'Explore real MEG recordings, run reproducible analysis pipelines, and share traceable results in the cloud.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0F14',
  width: 'device-width',
  initialScale: 1,
};

const RootLayout = ({ children }: LayoutProps<'/'>) => {
  return (
    <html lang='en' className='h-full'>
      <body className='min-h-full'>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { themeBootScript } from '@/components/atoms/theme-provider';
import { Providers } from '@/components/providers';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

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
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://meg-lab.example.com',
    siteName: 'MEG Lab',
    title: 'MEG Lab — Computational Electrophysiology Workbench',
    description:
      'Explore real MEG recordings, run reproducible analysis pipelines, and share traceable results in the cloud.',
    images: [{ url: '/og/og.png', width: 1200, height: 630, alt: 'MEG Lab' }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f14' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const RootLayout = ({ children }: LayoutProps<'/'>) => {
  return (
    <html lang='en' className={`${inter.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className='min-h-full'>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;

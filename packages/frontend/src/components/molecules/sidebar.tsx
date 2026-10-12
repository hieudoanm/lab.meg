'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const IconHome = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      className='h-4 w-4'>
      <path d='M3 10.5 12 3l9 7.5' />
      <path d='M5 9.5V21h14V9.5' />
    </svg>
  );
};

const IconProjects = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      className='h-4 w-4'>
      <path d='M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' />
    </svg>
  );
};

const IconDatasets = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      className='h-4 w-4'>
      <ellipse cx='12' cy='5' rx='8' ry='3' />
      <path d='M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5' />
      <path d='M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3' />
    </svg>
  );
};

const IconSignalViewer = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='h-4 w-4'>
      <path d='M3 12h4l3-8 4 16 3-8h4' />
    </svg>
  );
};

const IconSensorExplorer = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='h-4 w-4'>
      <path d='M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2' />
      <path d='M12 4v16M4 12h16' />
    </svg>
  );
};

const IconPipelines = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      className='h-4 w-4'>
      <rect x='7' y='7' width='10' height='10' rx='1' />
      <path d='M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3' />
    </svg>
  );
};

const IconNotebooks = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='h-4 w-4'>
      <path d='m8 9-3 3 3 3' />
      <path d='m16 9 3 3-3 3' />
      <path d='m13 5-2 14' />
    </svg>
  );
};

const IconExplore = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='h-4 w-4'>
      <circle cx='12' cy='12' r='8' />
      <path d='m14.5 9.5-1.8 4.7-4.7 1.8 1.8-4.7Z' />
    </svg>
  );
};

const IconSettings = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      className='h-4 w-4'>
      <circle cx='12' cy='12' r='3' />
      <path d='M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3H9.8L9.4 5.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4.4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z' />
    </svg>
  );
};

const NAV_ITEMS: NavItem[] = [
  { href: '/app', label: 'Home', icon: <IconHome /> },
  { href: '/app/projects', label: 'Projects', icon: <IconProjects /> },
  { href: '/app/datasets', label: 'Datasets', icon: <IconDatasets /> },
  { href: '/app/signal-viewer', label: 'Signal Viewer', icon: <IconSignalViewer /> },
  { href: '/app/sensor-explorer', label: 'Sensor Explorer', icon: <IconSensorExplorer /> },
  { href: '/app/pipelines', label: 'Pipelines', icon: <IconPipelines /> },
  { href: '/app/notebooks', label: 'Notebooks', icon: <IconNotebooks /> },
  { href: '/app/explore', label: 'Explore', icon: <IconExplore /> },
  { href: '/app/settings', label: 'Settings', icon: <IconSettings /> },
];

const isActive = (pathname: string, href: string): boolean => {
  return pathname === href || pathname.startsWith(`${href}/`);
};

const NavLinks = ({
  pathname,
  onNavigate,
}: {
  pathname: string | null;
  onNavigate?: () => void;
}) => {
  return (
    <ul className='menu w-full gap-0.5 p-0'>
      {NAV_ITEMS.map((item) => {
        const active = pathname !== null && isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                active
                  ? 'bg-accent-muted text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              )}>
              <span className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : '')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

const ActiveNavLinks = ({ onNavigate }: { onNavigate: () => void }) => {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} onNavigate={onNavigate} />;
};

export const Sidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='btn btn-outline btn-sm lg:hidden'
        aria-expanded={open}
        aria-controls='app-sidebar'>
        <span aria-hidden='true'>☰</span>
        Menu
      </button>

      {open ? (
        <button
          type='button'
          aria-label='Close navigation'
          className='bg-overlay-scrim/60 fixed inset-0 z-40 lg:hidden'
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id='app-sidebar'
        className={cn(
          'border-border bg-surface fixed inset-y-0 left-0 z-50 w-60 border-r p-4 transition-transform lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}>
        <div className='mb-6 flex items-center justify-between'>
          <Link href='/app' className='flex items-center gap-2.5'>
            <span
              aria-hidden='true'
              className='bg-accent text-background flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold'>
              M
            </span>
            <span className='text-text-primary text-[15px] font-semibold tracking-tight'>
              MEG Lab
            </span>
          </Link>
          <button
            type='button'
            onClick={() => setOpen(false)}
            className='btn btn-ghost btn-sm lg:hidden'
            aria-label='Close navigation'>
            ×
          </button>
        </div>
        <nav aria-label='Primary'>
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks onNavigate={() => setOpen(false)} />
          </Suspense>
        </nav>
        <div className='border-border text-text-muted mt-6 border-t px-1 pt-3 text-[11px]'>
          v0.1.0 · prototype
        </div>
      </aside>
    </>
  );
};

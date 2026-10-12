import { SignOutButton } from '@/components/molecules/sign-out-button';

import { ProjectSwitcher } from './project-switcher';

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export interface TopBarProps {
  userName: string;
}

export const TopBar = ({ userName }: TopBarProps) => {
  return (
    <header className='border-border bg-surface/95 sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b px-4 backdrop-blur sm:px-6'>
      <div className='flex min-w-0 items-center gap-3'>
        <ProjectSwitcher />
      </div>

      <div className='flex items-center gap-2'>
        <div className='border-border bg-surface-muted text-text-muted hidden items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] lg:flex'>
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='1.7'
            strokeLinecap='round'
            className='h-4 w-4'
            aria-hidden='true'>
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
          <span>Search recordings, runs…</span>
          <kbd className='border-border ml-4 rounded border px-1.5 text-[11px]'>⌘K</kbd>
        </div>

        <button
          type='button'
          aria-label='Notifications'
          className='focus-ring border-border bg-surface-muted text-text-secondary hover:text-text-primary relative flex h-9 w-9 items-center justify-center rounded-md border'>
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='1.7'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='h-4 w-4'
            aria-hidden='true'>
            <path d='M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6' />
            <path d='M10 20a2 2 0 0 0 4 0' />
          </svg>
          <span className='bg-accent absolute top-2 right-2 h-1.5 w-1.5 rounded-full' />
        </button>

        <details className='dropdown dropdown-end'>
          <summary className='btn btn-ghost btn-sm list-none'>
            <span className='border-border bg-surface-muted flex items-center gap-2 rounded-md border py-1 pr-2 pl-1'>
              <span
                aria-hidden='true'
                className='bg-accent-muted text-accent flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold'>
                {initials(userName)}
              </span>
              <span className='text-text-secondary hidden text-[13px] sm:inline'>{userName}</span>
            </span>
          </summary>
          <ul className='dropdown-content menu border-border bg-surface-raised rounded-box z-50 mt-3 w-44 border p-1 shadow-[var(--shadow-elevation-2)]'>
            <li>
              <a href='/app/settings'>Settings</a>
            </li>
            <li>
              <SignOutButton />
            </li>
          </ul>
        </details>
      </div>
    </header>
  );
};

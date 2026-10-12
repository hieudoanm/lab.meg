'use client';

import { useEffect, useState } from 'react';

import { fetchProjects } from '@/lib/api';
import type { ProjectSummary } from '@/lib/api/types';

const ACTIVE_PROJECT_KEY = 'meg-lab:active-project';

export interface ProjectSwitcherProps {
  onProjectChange?: (projectId: string | null) => void;
}

export const ProjectSwitcher = ({ onProjectChange }: ProjectSwitcherProps) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [active, setActive] = useState<ProjectSummary | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProjects({ limit: 50 })
      .then((page) => {
        if (cancelled) {
          return;
        }
        setProjects(page.items);
        const stored = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
        const initial =
          page.items.find((item) => item.id === stored) ??
          page.items.find((item) => item.archived_at === null) ??
          null;
        setActive(initial);
      })
      .catch(() => {
        if (!cancelled) {
          setProjects([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (project: ProjectSummary | null) => {
    setActive(project);
    setOpen(false);
    if (project) {
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
    } else {
      window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
    onProjectChange?.(project?.id ?? null);
  };

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={() => setOpen((current) => !current)}
        aria-haspopup='listbox'
        aria-expanded={open}
        className='focus-ring border-border bg-surface-muted flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px]'>
        <span className='text-text-muted'>Project</span>
        {active ? (
          <>
            <span className='text-text-primary font-medium'>{active.name}</span>
            <span className='bg-accent-muted text-accent rounded px-1.5 text-[11px]'>
              {active.visibility}
            </span>
          </>
        ) : (
          <span className='text-text-primary font-medium'>
            {projects.length > 0 ? 'All projects' : 'No projects'}
          </span>
        )}
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.7'
          className='h-3.5 w-3.5'
          aria-hidden='true'>
          <path d='m6 9 6 6 6-6' />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type='button'
            aria-label='Close project menu'
            className='fixed inset-0 z-40'
            onClick={() => setOpen(false)}
          />
          <ul
            role='listbox'
            aria-label='Active project'
            className='border-border bg-surface-raised rounded-box absolute left-0 z-50 mt-2 max-h-80 w-72 overflow-y-auto border p-1 shadow-[var(--shadow-elevation-2)]'>
            <li key='all'>
              <button
                type='button'
                role='option'
                aria-selected={active === null}
                onClick={() => handleSelect(null)}
                className='hover:bg-surface-muted focus-ring w-full rounded-md px-3 py-2 text-left text-sm'>
                All projects
              </button>
            </li>
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type='button'
                  role='option'
                  aria-selected={active?.id === project.id}
                  onClick={() => handleSelect(project)}
                  className='hover:bg-surface-muted focus-ring w-full rounded-md px-3 py-2 text-left'>
                  <span className='flex items-center justify-between gap-2'>
                    <span className='truncate text-sm font-medium'>{project.name}</span>
                    <span className='bg-accent-muted text-accent shrink-0 rounded px-1.5 text-[11px]'>
                      {project.visibility === 'public' ? 'public' : 'private'}
                    </span>
                  </span>
                  <span className='text-text-secondary mt-0.5 block truncate text-xs'>
                    {project.dataset_count} recordings · {project.run_count} runs
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
};

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchProjects, toErrorMessage } from '@/lib/api';
import type { ProjectSummary } from '@/lib/api/types';
import { formatRelativeTime } from '@/lib/format';
import { projectStatusLabel, projectStatusTone } from '@/lib/status';

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const systemOf = (project: ProjectSummary): 'OPM' | 'SQUID' | null => {
  if (project.archived_at) {
    return null;
  }
  const haystack = `${project.name} ${project.description ?? ''}`.toLowerCase();
  return haystack.includes('opm') ? 'OPM' : 'SQUID';
};

const SystemBadge = ({ system }: { system: 'OPM' | 'SQUID' | null }) => {
  if (system === null) {
    return (
      <span className='bg-surface-muted text-text-muted inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
        –
      </span>
    );
  }
  const classes =
    system === 'OPM' ? 'bg-success-muted text-success' : 'bg-accent-muted text-accent';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${classes}`}>
      {system}
    </span>
  );
};

const RoleBadge = ({ project }: { project: ProjectSummary }) => {
  if (project.role === 'owner') {
    return (
      <span className='bg-accent-muted text-accent rounded px-1.5 text-[11px] font-medium'>
        Owned
      </span>
    );
  }
  return (
    <span className='border-border text-text-muted rounded border px-1.5 text-[11px] font-medium'>
      Shared · {project.role}
    </span>
  );
};

export const ProjectsView = () => {
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'private' | 'public'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const query = useQuery({
    queryKey: ['projects', { includeArchived: true }],
    queryFn: () => fetchProjects({ limit: 50, includeArchived: true }),
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((project) => {
      const matchesTerm =
        term.length === 0 ||
        project.name.toLowerCase().includes(term) ||
        (project.description?.toLowerCase().includes(term) ?? false);
      const matchesVisibility = visibility === 'all' || project.visibility === visibility;
      return matchesTerm && matchesVisibility;
    });
  }, [items, search, visibility]);

  if (query.isLoading) {
    return <LoadingState label='Loading projects…' />;
  }
  if (query.isError) {
    return <ErrorState message={toErrorMessage(query.error)} />;
  }

  const columns: DataTableColumn<ProjectSummary>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (project) => (
        <div className='flex flex-col gap-0.5'>
          <div className='flex items-center gap-2'>
            <Link
              href={`/app/projects/${project.id}`}
              className='text-text-primary hover:text-accent font-medium'>
              {project.name}
            </Link>
            <RoleBadge project={project} />
          </div>
          {project.description ? (
            <span className='text-text-muted text-[12px]'>{project.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'visibility',
      header: 'Visibility',
      render: (project) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
            project.visibility === 'public'
              ? 'bg-info-muted text-info'
              : 'bg-surface-muted text-text-secondary'
          }`}>
          <span aria-hidden='true' className='h-1.5 w-1.5 rounded-full bg-current' />
          {project.visibility === 'public' ? 'public sample' : 'private'}
        </span>
      ),
    },
    {
      key: 'system',
      header: 'System',
      render: (project) => <SystemBadge system={systemOf(project)} />,
    },
    {
      key: 'datasets',
      header: 'Datasets',
      className: 'text-right',
      render: (project) => <span className='font-mono text-[13px]'>{project.dataset_count}</span>,
    },
    {
      key: 'runs',
      header: 'Runs',
      className: 'text-right',
      render: (project) => <span className='font-mono text-[13px]'>{project.run_count}</span>,
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (project) => (
        <span className='text-text-secondary text-[13px]'>
          {formatRelativeTime(project.updated_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (project) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
            projectStatusTone(project.archived_at ? 'archived' : 'active') === 'success'
              ? 'bg-success-muted text-success'
              : 'bg-surface-muted text-text-muted'
          }`}>
          {projectStatusLabel(project.archived_at ? 'archived' : 'active')}
        </span>
      ),
    },
  ];

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Projects'
        description='Organise recordings, pipeline versions, and reproducible event-related analysis runs into shared project scopes.'
        actions={
          <>
            <Link href='/app/datasets/new' className='btn btn-outline btn-sm'>
              Import
            </Link>
            <Link href='/app/projects/new' className='btn btn-primary btn-sm'>
              New project
            </Link>
          </>
        }
      />

      <div className='card border-border bg-surface rounded-lg border p-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search projects by name or description…'
            aria-label='Search projects'
            className='input input-bordered bg-surface-muted h-9 min-w-[240px] flex-1 text-[13px]'
          />
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as typeof visibility)}
            aria-label='Filter by visibility'
            className='select select-bordered bg-surface-muted h-9 text-[13px]'>
            <option value='all'>All visibility</option>
            <option value='private'>Private</option>
            <option value='public'>Public sample</option>
          </select>
          <div className='border-border bg-surface-muted ml-auto flex items-center gap-1 rounded-md border p-0.5'>
            <button
              type='button'
              onClick={() => setViewMode('table')}
              className={`rounded px-2.5 py-1 text-[12px] font-medium ${
                viewMode === 'table' ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'
              }`}>
              Table
            </button>
            <button
              type='button'
              onClick={() => setViewMode('cards')}
              className={`rounded px-2.5 py-1 text-[12px] font-medium ${
                viewMode === 'cards' ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'
              }`}>
              Cards
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title='No projects yet'
          description='Create a project to organise recordings, pipeline versions, and runs.'
          action={
            <Link href='/app/projects/new' className='btn btn-primary btn-sm'>
              New project
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResultsState description='No projects match the current filters.' />
      ) : viewMode === 'table' ? (
        <DataTable columns={columns} rows={filtered} getRowKey={(project) => project.id} />
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/app/projects/${project.id}`}
              className='card border-border bg-surface hover:border-border-strong rounded-lg border p-4 transition'>
              <div className='flex items-center gap-2'>
                <span
                  aria-hidden='true'
                  className='bg-accent-muted text-accent flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold'>
                  {initials(project.name)}
                </span>
                <span className='text-text-primary font-medium'>{project.name}</span>
              </div>
              <p className='text-text-secondary mt-2 line-clamp-2 text-[13px]'>
                {project.description ?? 'No description.'}
              </p>
              <div className='text-text-muted mt-3 flex items-center gap-3 text-[12px]'>
                <span>{project.dataset_count} datasets</span>
                <span>{project.run_count} runs</span>
                <span className='ml-auto'>{formatRelativeTime(project.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

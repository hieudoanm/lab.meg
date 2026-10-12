import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface MetadataItem {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

export interface MetadataGridProps {
  items: MetadataItem[];
  className?: string;
  columns?: 1 | 2 | 3;
}

const COLUMN_CLASSES: Record<1 | 2 | 3, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

export const MetadataGrid = ({ items, className, columns = 2 }: MetadataGridProps) => {
  return (
    <dl className={cn('grid gap-4', COLUMN_CLASSES[columns], className)}>
      {items.map((item) => (
        <div key={item.label} className='flex flex-col gap-1'>
          <dt className='text-text-muted text-[11px] font-semibold tracking-wider uppercase'>
            {item.label}
          </dt>
          <dd className={cn('text-text-primary text-sm', item.mono ? 'font-mono' : '')}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

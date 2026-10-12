import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  caption?: string;
  className?: string;
}

export const DataTable = <T,>({
  columns,
  rows,
  getRowKey,
  caption,
  className,
}: DataTableProps<T>) => {
  return (
    <div className={cn('border-border overflow-x-auto rounded-lg border', className)}>
      <table className='table-sm table w-full'>
        {caption ? (
          <caption className='text-text-secondary p-3 text-left text-xs'>{caption}</caption>
        ) : null}
        <thead>
          <tr className='border-border border-b'>
            {columns.map((column) => (
              <th
                key={column.key}
                scope='col'
                className={cn(
                  'text-text-secondary text-xs font-semibold tracking-wide uppercase',
                  column.className,
                )}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className='border-border hover:bg-surface-muted border-b last:border-0'>
              {columns.map((column) => (
                <td key={column.key} className={cn('align-middle', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

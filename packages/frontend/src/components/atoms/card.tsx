import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export const Card = ({ children, className, title, description, actions }: CardProps) => {
  return (
    <section className={cn('card border-border bg-surface border', className)}>
      {title ? (
        <header className='border-border flex items-start justify-between gap-4 border-b px-5 py-4'>
          <div>
            <h2 className='card-title text-base font-semibold'>{title}</h2>
            {description ? <p className='text-text-secondary text-sm'>{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className='p-5'>{children}</div>
    </section>
  );
};

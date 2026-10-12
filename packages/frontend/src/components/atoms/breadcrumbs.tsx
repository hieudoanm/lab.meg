import Link from 'next/link';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export const Breadcrumbs = ({ items }: { items: Breadcrumb[] }) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <nav aria-label='Breadcrumb' className='text-text-secondary text-sm'>
      <ol className='flex flex-wrap items-center gap-2'>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className='flex items-center gap-2'>
              {item.href && !isLast ? (
                <Link href={item.href} className='hover:text-text-primary hover:underline'>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className='text-text-primary'>
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden='true' className='text-text-muted'>
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

import { SkeletonTable } from '@/components/atoms/states';

const AppLoading = () => {
  return (
    <div className='flex flex-col gap-6'>
      <span className='bg-surface-muted h-8 w-56 animate-pulse rounded' />
      <SkeletonTable rows={4} columns={4} />
    </div>
  );
};

export default AppLoading;

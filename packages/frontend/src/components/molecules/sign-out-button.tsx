'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export const SignOutButton = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    setPending(true);
    try {
      await fetch('/api/session', { method: 'DELETE' });
    } finally {
      setPending(false);
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <button type='button' onClick={handleSignOut} disabled={pending} className='w-full text-left'>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
};

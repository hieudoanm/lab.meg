'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/atoms/button';
import { TextField } from '@/components/atoms/text-field';

const signInErrorMessage = (status: number): string => {
  if (status === 401) {
    return 'Email or password is incorrect.';
  }
  if (status === 429) {
    return 'Too many attempts. Please wait and try again.';
  }
  if (status >= 500) {
    return 'Sign-in is temporarily unavailable. Please try again.';
  }
  return 'We could not sign you in. Check your connection and try again.';
};

export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim().length === 0 || password.length === 0) {
      setError('Enter your email address and password to continue.');
      return;
    }

    setError(null);
    setPending(true);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) {
        setError(signInErrorMessage(response.status));
        return;
      }
    } catch {
      setError(signInErrorMessage(0));
      return;
    } finally {
      setPending(false);
    }

    const next = searchParams.get('next');
    router.push(next && next.startsWith('/app') ? next : '/app');
    router.refresh();
  };

  return (
    <form className='mt-6 flex flex-col gap-4' onSubmit={handleSubmit} noValidate>
      <TextField
        name='email'
        type='email'
        label='Email address'
        autoComplete='email'
        placeholder='you@institution.edu'
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <TextField
        name='password'
        type='password'
        label='Password'
        autoComplete='current-password'
        placeholder='••••••••••••'
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error ? (
        <p role='alert' className='text-danger text-sm'>
          {error}
        </p>
      ) : null}
      <Button type='submit' disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
};

import { endSession, login } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { guard, protectedProcedure, publicProcedure, router } from '../trpc';

const tokenMaxAgeSeconds = (expiresAt: string): number => {
  const remaining = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
  return Number.isFinite(remaining) && remaining > 0 ? remaining : 3600;
};

/**
 * Identity and session procedures.
 *
 * `session` is the single read used by server components to resolve the signed
 * in user; the mutations own the auth cookies.
 */
export const identityRouter = router({
  session: protectedProcedure.query(({ ctx }) => ctx.user),

  current: protectedProcedure.query(({ ctx }) => ctx.user),

  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await guard(() =>
        login({ email: input.email, password: input.password }, ctx.client),
      );

      await ctx.setSessionToken(response.access_token, tokenMaxAgeSeconds(response.expires_at));
      await ctx.setUserCookie(
        response.user.display_name ?? input.email.split('@')[0],
        response.user.email,
      );
      revalidatePath('/app', 'layout');
      return { expiresAt: response.expires_at };
    }),

  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await endSession(ctx.client);
    } catch {
      // A failed upstream logout must not trap the user in a signed-in state.
    }
    await ctx.clearSessionToken();
    await ctx.clearUserCookie();
    revalidatePath('/app', 'layout');
  }),
});

export type IdentityRouter = typeof identityRouter;

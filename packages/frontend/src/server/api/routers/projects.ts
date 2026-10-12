import {
  archiveProject,
  createProject,
  fetchProject,
  fetchProjectMembers,
  fetchProjects,
  updateProject,
} from '@/lib/api';
import { z } from 'zod';

import { guard, protectedProcedure, router } from '../trpc';

export const projectsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        cursor: z.string().nullable().optional(),
        search: z.string().optional(),
        includeArchived: z.boolean().optional(),
      }),
    )
    .query(({ ctx, input }) => guard(() => fetchProjects(input, ctx.client))),

  get: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchProject(input.projectId, ctx.client))),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        visibility: z.enum(['private', 'public']).optional(),
      }),
    )
    .mutation(({ ctx, input }) => guard(() => createProject(input, ctx.client))),

  update: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        visibility: z.enum(['private', 'public']).optional(),
        archived_at: z.string().nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { projectId, ...body } = input;
      return guard(() => updateProject(projectId, body, ctx.client));
    }),

  archive: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(({ ctx, input }) => guard(() => archiveProject(input.projectId, ctx.client))),

  members: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchProjectMembers(input.projectId, ctx.client))),
});

export type ProjectsRouter = typeof projectsRouter;

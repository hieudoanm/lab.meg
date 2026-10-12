import {
  cancelRun,
  fetchArtifactDownloadUrl,
  fetchRun,
  fetchRunArtifacts,
  fetchRunLogs,
  fetchRuns,
  rerun,
  submitRun,
} from '@/lib/api';
import { z } from 'zod';

import { guard, protectedProcedure, router } from '../trpc';

export const runsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        cursor: z.string().nullable().optional(),
        projectId: z.string().optional(),
        status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']).optional(),
        datasetVersionId: z.string().optional(),
        pipelineVersionId: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) => guard(() => fetchRuns(input, ctx.client))),

  get: protectedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchRun(input.runId, ctx.client))),

  submit: protectedProcedure
    .input(
      z.object({
        project_id: z.string().min(1),
        pipeline_version_id: z.string().min(1),
        dataset_version_id: z.string().min(1),
        parameters: z.record(z.string(), z.unknown()),
        idempotencyKey: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { idempotencyKey, ...body } = input;
      return guard(() => submitRun(body, idempotencyKey, ctx.client));
    }),

  cancel: protectedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(({ ctx, input }) => guard(() => cancelRun(input.runId, ctx.client))),

  rerun: protectedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(({ ctx, input }) => guard(() => rerun(input.runId, ctx.client))),

  logs: protectedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchRunLogs(input.runId, ctx.client))),

  artifacts: protectedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchRunArtifacts(input.runId, ctx.client))),

  artifactDownloadUrl: protectedProcedure
    .input(z.object({ artifactId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchArtifactDownloadUrl(input.artifactId, ctx.client))),
});

export type RunsRouter = typeof runsRouter;

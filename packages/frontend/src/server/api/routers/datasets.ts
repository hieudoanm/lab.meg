import {
  createUploadSession,
  fetchDataset,
  fetchDatasetAssets,
  fetchDatasetRecordings,
  fetchDatasetVersions,
  fetchDatasets,
  fetchFileAssetDownloadUrl,
  fetchProjectDatasets,
} from '@/lib/api';
import { z } from 'zod';

import { guard, protectedProcedure, router } from '../trpc';

export const datasetsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        cursor: z.string().nullable().optional(),
        projectId: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const projectId = input.projectId;
      if (projectId) {
        return guard(() => fetchProjectDatasets(projectId, input, ctx.client));
      }
      return guard(() => fetchDatasets(input, ctx.client));
    }),

  get: protectedProcedure
    .input(z.object({ datasetId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchDataset(input.datasetId, ctx.client))),

  recordings: protectedProcedure
    .input(z.object({ datasetId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchDatasetRecordings(input.datasetId, ctx.client))),

  versions: protectedProcedure
    .input(z.object({ datasetId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchDatasetVersions(input.datasetId, ctx.client))),

  assets: protectedProcedure
    .input(z.object({ datasetVersionId: z.string().min(1) }))
    .query(({ ctx, input }) => guard(() => fetchDatasetAssets(input.datasetVersionId, ctx.client))),

  createUpload: protectedProcedure
    .input(
      z.object({
        datasetId: z.string().min(1),
        file_name: z.string().min(1),
        file_size_bytes: z.number().positive(),
        expected_checksum_sha256: z.string().optional().nullable(),
        media_type: z.string().optional().nullable(),
      }),
    )
    .mutation(({ ctx, input }) =>
      guard(() => createUploadSession(input.datasetId, input, ctx.client)),
    ),

  fileDownloadUrl: protectedProcedure
    .input(z.object({ fileAssetId: z.string().min(1) }))
    .query(({ ctx, input }) =>
      guard(() => fetchFileAssetDownloadUrl(input.fileAssetId, ctx.client)),
    ),
});

export type DatasetsRouter = typeof datasetsRouter;

import { identityRouter } from './routers/identity';
import { projectsRouter } from './routers/projects';
import { datasetsRouter } from './routers/datasets';
import { runsRouter } from './routers/runs';
import { router } from './trpc';

/**
 * The BFF router surface exposed to the React tree.
 *
 * Every procedure delegates to the typed REST client (`@/lib/api`), so the
 * browser never talks to the Python API directly.
 */
export const appRouter = router({
  identity: identityRouter,
  projects: projectsRouter,
  datasets: datasetsRouter,
  runs: runsRouter,
});

export type AppRouter = typeof appRouter;

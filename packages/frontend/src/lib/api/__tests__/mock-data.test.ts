import { describe, expect, it } from 'vitest';

import {
  mockCurrentUser,
  mockDatasets,
  mockProjects,
  mockRuns,
  paged,
  runById,
} from '@/lib/api/mock-data';

describe('mock data', () => {
  it('wraps items in a page envelope', () => {
    const page = paged([1, 2, 3]);
    expect(page).toEqual({ items: [1, 2, 3], next_cursor: null, has_more: false });
  });

  it('exposes the canonical current user', () => {
    expect(mockCurrentUser.display_name).toBe('Hieu Doan');
  });

  it('keeps project dataset counts consistent with the declared counts', () => {
    for (const project of mockProjects) {
      const actual = mockDatasets.filter((dataset) => dataset.project_id === project.id).length;
      expect(actual).toBe(project.dataset_count);
    }
  });

  it('resolves every canonical run by id', () => {
    for (const run of mockRuns) {
      expect(runById(run.id).id).toBe(run.id);
    }
  });

  it('gives every dataset a stable current version', () => {
    for (const dataset of mockDatasets) {
      expect(dataset.current_dataset_version).not.toBeNull();
      expect(dataset.current_dataset_version?.dataset_id).toBe(dataset.id);
    }
  });
});

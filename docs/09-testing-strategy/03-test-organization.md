# Test Organization

## 5. Test Directory Structure

```
lab.meg/
├── packages/
│   ├── frontend/src/__tests__/ or colocated; e2e/
│   └── backend/app/... and tests/{unit,integration,api,security,fixtures}
├── workers/tests/{unit,integration,fixtures}
└── tests/e2e/
```

Shared MEG fixture generators live in importable modules to ensure consistency across API/worker/scientific tests.


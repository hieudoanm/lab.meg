# Post-MVP Opportunities

## 17. Post-MVP Opportunities

Only consider these after the MVP is stable, and only with a clear user need, documented acceptance criteria, and a test strategy:

- BIDS ingestion and validation as an organisation layer (FR-027).
- Additional, well-tested signal operations and artifact-correction methods.
- Hosted Python notebooks with controlled access to project recordings, in isolated runtimes.
- A visual pipeline editor with parameter forms and intermediate outputs.
- Time-frequency analysis and event-related spectral changes.
- Independent component analysis (ICA) and signal-space projection (SSP) workflows with channel prerequisites.
- Forward models and source estimation with compatible anatomical MRI data.
- Functional connectivity analysis.
- OPM-specific background-field handling and sensor-movement workflows.
- API keys, a Python SDK, and programmatic job submission.
- Public analysis galleries, community pipelines, and a plugin SDK.
- Optional integration with MRI and EEG projects through the same project and experiment model.
- Re-evaluate cloud infrastructure and Terraform only if self-hosting is proven and demand justifies the operational cost.

Do not wait until a late release to build the data model for provenance and versioning. The foundation is established early even when the initial interface exposes only a subset of it.

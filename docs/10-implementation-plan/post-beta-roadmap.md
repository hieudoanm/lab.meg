# Post-Beta Roadmap

## 10. Post-Beta Roadmap

After the private beta, releases follow the roadmap in `docs/README.md` section 12. Each release is only started once the previous one is stable, with a clear user need, documented acceptance criteria, and a test strategy.

| Release | Focus               | Deliverables                                                     |
| ------- | ------------------- | ---------------------------------------------------------------- |
| V1      | Core analysis       | Epoching, evoked responses, PSD, channel quality tools           |
| V1.5    | OPM workflows       | Sensor geometry, relevant diagnostics, specialised preprocessing |
| V2      | Developer workbench | Hosted notebooks, Python SDK, reusable pipelines                 |
| V3      | Source analysis     | Forward modelling, source estimation, anatomical visualisation   |
| V4      | Research platform   | BIDS workflows, collaboration, public experiments, plugins       |
| V5      | Multimodal research | Optional integration with MRI and EEG projects                   |

The milestone order should follow technical dependencies and user feedback. Build foundations for advanced source analysis early without exposing a half-finished source-localisation interface in the beta.

### 10.1 Post-beta task outline

- [ ] V1: finish channel-quality tooling and consolidate the analysis result views.
- [ ] V1.5: expand OPM diagnostics, background-field handling, and sensor-movement workflows where tracking data exists.
- [ ] V2: add isolated hosted notebooks, a Python SDK, and reusable pipeline packages.
- [ ] V3: add forward modelling, source estimation, and anatomical visualisation with compatible MRI data.
- [ ] V4: add BIDS import and validation (FR-027), collaboration, public experiments, and a plugin surface.
- [ ] V5: integrate with MRI and EEG projects behind the same project and experiment model.


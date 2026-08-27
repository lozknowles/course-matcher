# Changelog

All notable changes to the Course Match prototype are recorded here so that support teams can understand both functional changes and operational/supportability changes.

The project currently follows a lightweight semantic-versioning approach:

- **major** — incompatible change to behaviour/data contract;
- **minor** — new user-facing capability;
- **patch** — fixes, documentation, deployment hardening and supportability improvements.

## Unreleased — CIS handover/supportability

### Correctness and safety

- Fixed uploaded images and PDFs so successfully extracted qualifications are passed directly into the editable verification UX.
- Removed the five-page PDF cap: every page is now read, with visual PDF table rows reconstructed before parsing.
- Added OCR fallback for unresolved/mixed PDF pages and reuse of one OCR worker across the document.
- Added a dedicated mobile camera input and accessible upload/progress state.
- Expanded conservative GCSE subject aliases and parsing for table spacing, adjacent-line grades, Combined Science pairs and legacy `A*`.
- Retained conflicting duplicate results for human review while deduplicating exact OCR/PDF repeats.
- Made the vendor build reject truncated or corrupt Tesseract English language data.
- Added regression and live-browser coverage for a seven-page PDF, photographed results, verification and match submission.
- Prevented duplicate and unrecognised adviser CSV subject columns from being counted as GCSE evidence.
- Added validation that blocks student matching until duplicate subjects, unsupported subjects and invalid grades are resolved.
- Added deterministic fallback cohort row IDs, replacing random IDs in imported CSV data.
- Added regression coverage proving that duplicate or arbitrary columns cannot fabricate a green GCSE-total match.
- Fixed the local vendor build on Windows by converting the module URL to a filesystem path correctly.

### Documentation

- Reworked `README.md` as a first-line onboarding and support guide for engineers with no prior project context.
- Added `ARCHITECTURE.md` covering components, browser data flows, rule schema, qualification handling, trust boundaries, privacy/security assumptions, failure behaviour, CI/deployment and productionisation options.
- Added explicit support guidance for course-rule ownership, safe changes, common failure symptoms and generated OCR/PDF dependencies.

### Code supportability

- Added module-level documentation and comments around the matching model, course-rule schema, browser orchestration and dependency-vendoring responsibilities.
- Documented the distinction between hard grade rules, advisory/non-grade warnings and manual-only rules.
- Documented Combined Science handling and the meaning of green/amber/red as indicative UI states rather than admissions decisions.

### Deployment hardening

- Corrected the demonstration deployment root to Apache's active `/var/www/lozknowles.com/public_html/dist` tree.
- Added route-scoped security, privacy and `noindex` headers compatible with local PDF.js/Tesseract workers and WebAssembly.
- Deployment now stages files in a directory writable by the SSH user before using `sudo` for the final Apache web-root install.
- Added backup-before-replace behaviour for the existing live demo.
- Added live verification of the application HTML plus PDF.js and Tesseract runtime files.
- Generated vendor assets are ignored by Git so a successful `npm run vendor` does not make the checkout dirty.
- Removed the tracked `vendor/README.md` placeholder because the vendor build intentionally recreates that directory.

## 1.0.0 — 2026-08-24

### Added

- Established the standalone `course-matcher` canonical project.
- Added student results upload/manual-entry flow with mandatory verification.
- Added local OCR/PDF vendor workflow with no runtime OCR API dependency.
- Added interest and career-aware course ranking.
- Added transparent green/amber/red rule evidence and non-grade warnings.
- Added Combined Science double-award handling.
- Added tutor/adviser reverse matching with synthetic cohort and CSV import.
- Added dated, source-linked Lincoln College course criteria snapshot.
- Added golden synthetic student regression tests.
- Added GitHub Actions validation for tests and vendor preparation.

### Safety/design boundaries

- No backend student-results store.
- OCR output must be human-verified before matching.
- Course rules are explicit and source-linked.
- Non-grade conditions are not silently treated as satisfied.
- Unencoded courses are linked but not given fabricated eligibility decisions.

### Initial regression coverage

The 1.0.0 regression suite validates:

- common OCR-style result parsing;
- Combined Science double-award counting;
- the golden synthetic student Level 2 Computing outcome;
- the golden student Level 3 Business near-match;
- a strong Level 3 Computing profile;
- interest filtering;
- Education/Childcare English/Maths requirements;
- Engineering cross-listing into the electronic/applied-computing pathway.

# Lincoln College Digital Student Journey — Demo 8

## Purpose and entry points

The student experiences one journey even when the college uses several systems. This independent, unofficial prototype follows fictional Jamie Taylor from finding a course to becoming a student. It answers: where am I, what have I completed, and what should I do next?

- Public route: https://www.lozknowles.com/lincoln-course-match/digital-student-journey.html
- Main suite: https://www.lozknowles.com/lincoln-course-match/
- Original focused workspace: `student-portal.html`, preserved with its existing behaviour and separate state.
- Start with **Run student journey demo**. Previous/Next and **Show all 10 steps** preserve progress. Future steps can be previewed but their actions are disabled.
- Presenter controls can reset, complete an example step, choose the lower-results scenario or load a synthetic example at any stage. Loading an example replaces only this demo's browser record.

The supplied text describes the physical Road to Success display. No wall photographs were present in the attachment directory, so the implementation follows that written ten-stage description and reuses the existing Lincoln logo. Navy/turquoise, yellow cards, red numbered markers and a friendly heading face translate the display into a responsive portal. This is not a claim of approved College branding.

## Ten screens and completion rules

| Step | Screen | Main action and completion evidence |
|---|---|---|
| 1 | Find out about us | Choose interests and predicted qualifications, run the shared matcher, search and save a course. Open the existing careers/ONS explorer in another tab. |
| 2 | Open Days | Book one of two explicitly fictional visits; the selected appointment becomes part of the record. |
| 3 | Apply online | Review course, shared contact/education/support details and qualifications; explicitly submit the simulated application. |
| 4 | We'll contact you | Application status, messages, invitation, tasks, documents and appointments; open the simulated conditional offer. |
| 5 | Attend a Welcome Day | Course team, fictional date/location, agenda and preparation; record simulated attendance. |
| 6 | While you wait | Saved offer, dated course requirements, example 49-day countdown, preparation and support links. |
| 7 | Complete your application | Local photograph/document selection, student-selected evidence category, education confirmation and declarations. Optional simulated DfE request/share. |
| 8 | Get your results | Camera, upload or manual entry; editable subject/qualification/grade rows; mandatory confirmation; shared course-rule assessment and alternatives. |
| 9 | Attend your Enrolment Day | Simulated check-in; seven-item checklist; inspect a local validated payload; explicit simulated staff enrolment confirmation. |
| 10 | Your career starts here | Student status, professional celebration, fictional induction/timetable/ID and first-day information. |

The desktop sidebar and mobile horizontal timeline group the ten stages into Discover, Apply, Welcome, Results, Enrol and Start college. All ten remain accessible in a keyboard-operable native dialog. Labels and text statuses supplement colour. Activity history is available on desktop and mobile.

## Reuse audit completed before implementation

| Existing work | Reuse and boundary |
|---|---|
| `courses.js` | Imports the existing subject catalogue and dated encoded entry rules directly. No second course catalogue. |
| `matcher-core.js` | Imports `rankCourses`, `matchCourse`, `validateGrades` and `parseResultsText`. The new UI uses the same subject/grade checks and conservative GCSE parser. |
| `document-core.js` | Imports PDF line reconstruction and all-page traversal. |
| Existing OCR/PDF runtime | Reuses the pinned, locally vendored Tesseract, English model and PDF.js. The journey adds a small file-processing adapter rather than another OCR service. |
| Career pathways and ONS work | Links the existing `student-hub/careers.html`, retaining its Skills England/ONS snapshots, provenance, exact occupation matching, salary coverage and quality limitations. It does not invent new salary estimates. |
| Student application / record layout | Reuses the existing tell-us-once fields and evidence-review concepts in a shared journey record. Forms are rendered for the new ten-stage shell. |
| Original Demo 8 | Reviewed `student-portal.*` and `DEMO-8.md`; carries forward DfE request/share, local OCR and mandatory human verification. Original files remain untouched. Its state is not silently synchronised with this demo. |
| Bishop Burton-style work | No separately reusable Bishop Burton component was found in this repository. Existing record-form layouts were reviewed; no external implementation is claimed to have been imported. |
| Enrolment dashboard | Reviewed `enrolment-core.js`; its staff cohort/capacity entities differ from the student record. The new checklist has independent student-side state, not an invented shared backend. |
| Logo/style | Uses `student-hub/logo.jpg` and the established Lincoln navy/pink palette, extended with turquoise/yellow journey styling. |
| ProSolution demonstrations | Preserves the existing automation demos. Reuses the documented test-first integration boundary, not their synthetic UI as evidence of an API. |
| Video tooling | No reusable journey recording pipeline was found. Browser screen captures and a small FFmpeg assembly script provide reproducible evidence. |

## New components and state

- `digital-student-journey.html`: shell, persistent navigation, presenter controls and technical view.
- `digital-student-journey.css`: responsive layout, branded cards, focus states, mobile timeline.
- `digital-student-journey.js`: UI events, persistence, capture orchestration and illustrative QR handling.
- `journey-core.js`: pure state transitions, guards, completion/status derivation, scenarios, payload and provenance.
- `journey-views.js`: ten screen renderers, course/results views and technical panel; user-entered text is escaped.
- `journey-capture.js`: upload limits, local image OCR, PDF text/OCR and existing parser adapter.
- `journey-assets/results-*.png`: two synthetic test documents; reproducible with `scripts/create-journey-fixtures.py`.
- `tests/digital-journey.test.mjs`: eleven journey tests, alongside all existing tests.
- `scripts/check-journey-browser.mjs`: responsive browser checks using an existing Codex browser tab.
- `scripts/render-journey-evidence.py`: MP4 walkthrough assembly from actual captured UI frames.

Version 1 state contains `student`, course/original course/saved choices, interests/predicted grades, `application`, `offer`, `preparation`, `documents`, `education`, `qualifications`, `careersRequest`, appointments under `events`, `messages`, `enrolment`, `tasks` and timestamped `activity`.

Completion derives from those records, rather than a page counter. Stage statuses are `NOT_STARTED`, `AVAILABLE`, `IN_PROGRESS`, `ACTION_REQUIRED` and `COMPLETE`. Validated transitions enforce prerequisites. The public phase progresses through Prospect, Applicant, Offer holder, Enrolment and Student. Navigating backwards does not undo progress; editing results or relevant identity/contact/course data invalidates downstream checks. Presenter examples use the same transition functions and explicitly identify synthetic events.

State saves under `lincoln-digital-journey-v1` in localStorage, separate from the existing demos. Reload restores the viewed stage and record; reset replaces this key only. Storage failures display an explanation. The last 120 events are retained. **Use synthetic data only:** there is no login, multi-user isolation, tamper-resistant audit or cross-device resume.

File contents and image previews remain in memory; only form data and evidence metadata are saved. After reload, any real selected image must be selected again to inspect it. The metadata checklist demonstrates completeness; it is not durable evidence storage and never proves identity. Sample portrait/evidence actions create labelled fictional placeholders.

## Results and alternatives

1. Camera input requests a rear-facing capture where the device supports it. A normal upload and manual entry remain available.
2. Accepts JPG, PNG, WebP, PDF, plain text and CSV, up to 12 MB; PDF processing is limited to ten pages. Photo input accepts only supported image types. HEIC must be converted or replaced with manual entry.
3. Local Tesseract reads images. PDF text is reconstructed by row; pages without recognised results use local OCR. No document is sent to a remote OCR provider.
4. Proposed GCSE rows remain editable. No rows are accepted until the student checks the confirmation box and submits them. Malformed or duplicate GCSEs are rejected. Other qualifications need a staff review.
5. The dated selected-course rules produce **Requirements appear satisfied**, **We need to check your results**, or **Let's look at your options**. None is a final admissions decision.
6. The lower-results fixture produces Maths 3, English Language 3, Biology 4, Chemistry 3 and Physics 4. It fails the Level 3 Computing example requirements and suggests Level 2 Computing & Electronics Technician using the same engine. Original choice is retained, a simulated careers request is recorded, and college verification remains explicit.
7. Every edit invalidates prior confirmation, previous results review and completed enrolment. Stale async OCR cannot overwrite a newer edit, navigation or reset.

**Read sample results photo** runs actual OCR on a synthetic PNG. **Load synthetic result rows** skips OCR and labels the source accordingly. These are deliberately distinct. OCR quality on clean fixtures does not establish accuracy on arbitrary photographed results.

## Enrolment and system boundaries

The checklist covers identity, photograph, results, course, contact, education and declarations. All must pass before a local payload is available. The payload declares `mode: DEMONSTRATION ONLY`, `integrated: false`, `staffVerificationRequired: true` and **NOT SENT**. Only a separate **Simulate college confirming enrolment** action changes the status to Student.

| Classification | What is demonstrated |
|---|---|
| WORKING | Existing matching/parsing modules and linked published careers/ONS explorer. |
| PROTOTYPE | New browser journey, local upload/OCR, editable verification, state/resume and payload validation. |
| SIMULATED | Bookings, offers, messages, attendance, identity/staff checks, DfE sharing and enrolment completion. Nothing is sent or booked. |
| PROPOSED | A supported ProSolution workflow, approved import/export or documented API, with staff verification/read-back. No invented endpoint, SQL write or live MIS operation. |
| REQUIRES VALIDATION | DfE access/permissions, supported MIS handoff, QR semantics, identity matching and production controls. |

The DfE concept follows the [published provider request and learner-share process](https://view-education-record.education.gov.uk/about/providers/get-education-records), checked on 21 September 2026. It is not authenticated or connected. A separate optional native `BarcodeDetector` camera prototype accepts only `DEMO-JAMIE-2027`; it does not accept URLs or read DfE credentials. Unsupported browsers show a manual illustrative-token fallback. The token does not establish identity. The camera stream is stopped when leaving the view.

Future real integration should start with supported native MIS capabilities, then approved import/export or documented APIs. Any automated changes require the College test environment, approved identities/permissions, audit, read-back/reconciliation and recovery before a supervised live pilot. This demo grants none of that authority.

## Validation and evidence

`npm ci`, `npm run vendor`, `npm test` and syntax checks are the local prerequisites. The full suite passes **64/64 tests** (11 new journey tests, 53 existing). Tests cover ten renderers, guarded transitions, reset/resume, confirmation/invalidation, exact entry checks, alternatives, enrolment prerequisites, status changes, file limits and provenance.

Browser testing used the actual UI on 21 September 2026:

- Desktop 1440 × 1000: all ten stages, complete student-driven happy path, actual sample-image OCR, seven enrolment checks, explicit college confirmation and persisted completion after reload.
- Pixel-sized 414 × 896: all ten stages, horizontal navigation, all-steps dialog, editable results, activity history, technical labels, reset and guarded future stage.
- iPhone-sized 390 × 844 and tablet 820 × 1180: all ten stages plus automated overflow, revisit, resume, reset and future-action assertions via `scripts/check-journey-browser.mjs`.
- Actual file chooser upload of the second PNG: five correct extracted grades, human confirmation, requirement differences and suggested alternative. Editing a confirmed grade clears the outcome and disables confirmation again.
- DfE sharing and illustrative QR are checked as simulated local flows. Physical Android/iPhone cameras, Safari and a real DfE QR are not qualified by viewport tests.

The browser check accepts an already-open synthetic demo tab and its viewport capability. It makes no network requests or storage mutations outside UI actions. In the Codex browser runtime import the module and call `checkJourneyBrowser(tab, viewport, recordCallback)`. The callback can capture each stage and save returned DOM/viewport evidence; reset temporary viewport overrides afterwards. This is separate from the Node test suite and does not launch an external browser driver.

Evidence includes representative screenshots and five walkthrough MP4s: `01-student-journey-desktop`, `02-student-journey-mobile`, `03-results-photo-flow`, `04-enrolment-flow`, and `05-alternative-course-flow`. **These MP4s are timed sequences assembled from verified browser screen captures, not continuous screen recordings or recordings of a physical camera.** The local evidence manifest lists the exact input frames and video hashes. Presenter-seeded mobile screens are labelled examples; the desktop happy path and OCR/upload actions were performed through the UI.

## Deployment and limitations

The release updates the Demo 8 card and adds eight new public files (HTML/CSS/controller, three modules and two fixtures). The existing scoped deploy helper checks a fresh full-file hash inventory, refuses drift, backs up changed files outside the web root, installs dependencies before HTML and verifies all untouched hashes. Existing demos, vendor assets, career data and service worker are not replaced. The general deployment allowlist also includes the new files for future complete releases.

No blocker prevents this public synthetic demonstration. Production adoption still needs durable/authenticated records and evidence, accessible device/browser qualification, current authoritative course/event data, approved integrations, real staff workflows and institutional review. Example appointments and countdowns deliberately use a fictional 2027 story. Linked [College support](https://www.lincolncollege.ac.uk/support) and [contact information](https://www.lincolncollege.ac.uk/contact-us) are official destinations; scripted requests may encounter the College's edge protection. The original workspace and linked career explorer remain separate applications, with no claim of shared authenticated state.

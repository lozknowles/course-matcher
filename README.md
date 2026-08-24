# Course Match — Lincoln College demonstration

Course Match is a small, static web application that demonstrates how GCSE results could be turned into clearer course conversations on results/enrolment days.

It has two user journeys:

1. **Student view** — enter or upload results, verify every extracted grade, select interests, and see transparent course matches.
2. **Tutor / adviser view** — select a course and triage an anonymised cohort to identify students who may be worth a human conversation.

> **Status:** independent demonstration/prototype. This is not an official Lincoln College service, is not endorsed by Lincoln College, and must not be treated as an admissions decision engine.

## Start here if you are supporting this for the first time

If you are a Lincoln College CIS engineer inheriting this repository, read these in order:

1. This `README.md` — purpose, operation, testing and routine support.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — components, data flows, rule model, privacy/security boundaries and productionisation considerations.
3. [`CHANGELOG.md`](CHANGELOG.md) — what changed and why.
4. `courses.js` — the dated course/rule snapshot.
5. `matcher-core.js` — pure matching and parsing logic.
6. `app.js` — browser UI orchestration, OCR/PDF handling and adviser workflow.
7. `tests/matcher.test.mjs` — executable examples of expected behaviour.

The application deliberately has **no application server or database**. It is plain HTML/CSS/JavaScript served as static files.

## Current live demonstration

The demonstration is intended to be hosted under:

```text
https://lozknowles.com/lincoln-course-match/
```

The canonical source repository is:

```text
https://github.com/lozknowles/course-matcher
```

The live demo location is a convenience for demonstration only; it is not a statement that the application is production-approved by Lincoln College.

## What problem the prototype explores

On enrolment/results days, a student may arrive with grades on paper, a screenshot, a PDF, a photograph or a manually entered list. Staff then need to understand what pathways may be worth discussing.

Course Match explores whether software can reduce the repetitive part of that process while keeping the judgement with a person:

```text
results document / manual entry
            ↓
local extraction / OCR
            ↓
mandatory human grade check
            ↓
normalised qualifications
            ↓
published rule checks
            ↓
interest-aware ranking
            ↓
transparent evidence + warnings
            ↓
human course conversation
```

The design rule is simple: **assist the conversation; never pretend to make the admissions decision.**

## Key features

- Static HTML/CSS/JavaScript; no application framework.
- No backend API and no student-results database.
- Manual GCSE grade entry.
- Image/screenshot OCR using Tesseract.js in the browser.
- PDF text extraction using PDF.js; image-only PDF pages can fall back to local OCR.
- Mandatory human verification of extracted grades before matching.
- Combined Science double-award support, e.g. `5-5`.
- Interest and career-text filtering/ranking.
- Green / amber / red indicative bands with the individual checks shown.
- Explicit warnings for non-grade conditions such as interviews, references, portfolios, DBS checks and placements.
- Tutor/adviser reverse matching using synthetic or anonymised CSV data.
- Source-linked and date-stamped course rules.
- Links to published subject areas even where no course-specific eligibility rule has been encoded.
- Regression tests for the matching engine.

## Privacy model

The current application processes student result files **inside the browser**.

There is no upload endpoint in this repository and the app does not deliberately transmit entered/uploaded results to a server-side application. Tesseract.js and PDF.js are vendored locally for the same reason: runtime OCR/PDF processing does not depend on a third-party OCR API.

That is a useful architectural property, but it is **not a substitute for College information-governance approval**. If CIS takes this beyond an unofficial prototype, perform the normal privacy, DPIA, records-management, cyber-security and accessibility reviews appropriate to the intended use.

For demonstrations:

- prefer the built-in synthetic student;
- use anonymised cohort IDs;
- do not load identifiable student data unless College governance explicitly permits it.

## Important functional boundary

The matcher recognises three categories:

### 1. Encoded grade rules

Examples:

- five GCSEs at grade 4+;
- Mathematics grade 5+;
- English Language grade 4+;
- one of a group of science subjects at grade 4+.

These rules are evaluated by `matcher-core.js` and shown back to the user as individual pass/check evidence.

### 2. Human-only conditions

Examples include:

- interviews;
- references;
- portfolios;
- DBS checks;
- placements;
- motivation/suitability;
- course-specific judgement.

These are **warnings**, never silently treated as passed.

### 3. Unencoded courses/subjects

The UI links to the official subject area but does not invent an eligibility result.

This boundary is intentional and should be preserved.

## Course data

`courses.js` is the current course/rule catalogue.

The existing rules are a **dated snapshot checked on 24 August 2026** against public Lincoln College pages. Each encoded course contains its source URL and `checked` date.

### Ownership expectation for a College-supported version

If CIS adopts the tool, the course-rule catalogue should have a named business/data owner. A sensible change process would be:

1. curriculum/admissions owner confirms the published requirement;
2. CIS updates the rule and source URL;
3. tests are added/updated for the changed rule;
4. `checked` is updated;
5. peer review confirms that hard requirements and human-only conditions have not been conflated;
6. the change is released and recorded in `CHANGELOG.md`.

Do not automate scraping directly into admissions logic without an approval/review boundary.

## Repository map

```text
.
├── index.html                 Static application shell
├── styles.css                 Responsive presentation
├── app.js                     Browser UI/controller and file-processing flows
├── matcher-core.js            Pure qualification parsing + matching engine
├── courses.js                 Course catalogue, rules, warnings and source links
├── tests/
│   └── matcher.test.mjs       Node regression tests for matching behaviour
├── scripts/
│   ├── vendor.mjs             Builds local Tesseract/PDF.js runtime assets
│   └── deploy-production.sh   Guarded demo deployment script
├── vendor/                    Generated browser dependencies; not canonical source
├── .github/workflows/ci.yml   GitHub Actions test/vendor validation
├── ARCHITECTURE.md            Technical design and handover documentation
├── CHANGELOG.md               Release/change history
└── package.json               Pinned development/runtime-vendoring dependencies
```

## Local development

Requirements:

- a modern browser;
- Node.js 22 is used by CI;
- npm;
- Python is convenient for a local static HTTP server but is not required by the application itself.

Clone and prepare:

```bash
git clone https://github.com/lozknowles/course-matcher.git
cd course-matcher
npm install
npm run vendor
```

Run a local static server:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Do not test ES modules by double-clicking `index.html` with a `file://` URL; use an HTTP server.

## Tests

Run:

```bash
npm test
```

The regression suite currently covers:

- OCR-style subject/grade parsing;
- Combined Science double-award counting;
- the golden synthetic student;
- representative Level 2 and Level 3 outcomes;
- interest filtering;
- Education/Childcare English/Maths logic;
- cross-listed Engineering/Computing pathways.

When changing matching behaviour or a course rule, add a regression test that demonstrates the intended behaviour before considering the change supportable.

## Golden demonstration case

The built-in **Load demo student** action uses this synthetic profile:

| Subject | Grade |
|---|---:|
| Mathematics | 5 |
| English Language | 4 |
| English Literature | 3 |
| Geography | 3 |
| Physics | 2 |
| Combined Science | 5 |

The single Combined Science `5` is intentionally treated conservatively as one evidenced qualification. A known double award should be entered as a pair such as `5-5`.

This prevents the matcher from silently inventing a second GCSE.

## Adviser CSV format

The first two columns are expected to be `id` and `interest`. Other columns are treated as qualification subjects.

```csv
id,interest,Mathematics,English Language,Combined Science,Geography
S-101,Computing,5,4,5-5,3
S-102,Sport,3,3,3-3,4
```

Use anonymised identifiers in demonstrations.

## Generated OCR/PDF dependencies

The repository pins:

- `tesseract.js`;
- `tesseract.js-core` via its dependency tree;
- English Tesseract language data;
- `pdfjs-dist`.

Run:

```bash
npm install
npm run vendor
```

`scripts/vendor.mjs` rebuilds `vendor/` from those installed dependencies. The generated assets are intentionally ignored by Git because `package.json` + the vendor script are the reproducible source of truth.

If image/PDF upload reports that the local vendor bundle is missing, this is the first thing to check.

## Static deployment

A generic deployment needs only:

```text
index.html
styles.css
app.js
matcher-core.js
courses.js
vendor/
```

No backend route is required.

### Existing demo deployment helper

`scripts/deploy-production.sh` is specific to the current demonstration environment. It:

1. refuses to deploy from a non-`main` or dirty checkout;
2. installs dependencies;
3. runs tests;
4. generates `vendor/`;
5. uploads to a writable remote staging directory;
6. backs up the previous demo;
7. uses `sudo` only for the final Apache document-root replacement;
8. verifies the public HTML and OCR/PDF assets.

CIS should treat that script as an example deployment implementation, not as a required College hosting architecture.

## Common support symptoms

| Symptom | Likely cause | First check |
|---|---|---|
| Manual matching works but image OCR fails | `vendor/` missing/incomplete | Run `npm install && npm run vendor` |
| PDF upload fails | PDF.js vendor files missing | Check `vendor/pdfjs/pdf.mjs` and worker |
| OCR text is wrong | OCR quality/input image | Correct in mandatory verification step |
| Too few GCSEs counted | Combined Science entered as one grade | Use `5-5` when a double award is evidenced |
| Course appears amber unexpectedly | One or more hard rules not evidenced | Read the displayed checks and rule in `courses.js` |
| Course requirement has changed | Dated catalogue is stale | Verify official source, update rule/date/test |
| Adviser CSV looks wrong | Header/quoting mismatch | Check documented `id,interest,...` shape |
| Deploy refuses a dirty checkout | Uncommitted/generated change | `git status --short`; do not bypass blindly |

## Safe-change checklist

Before merging a change:

```bash
npm test
node --check app.js
node --check matcher-core.js
node --check courses.js
node --check scripts/vendor.mjs
```

For course-rule changes also confirm:

- official source URL;
- source wording;
- whether wording is mandatory or advisory;
- `checked` date;
- a regression test;
- non-grade conditions remain warnings.

## What CIS should consider before production adoption

The current prototype intentionally avoids building infrastructure that was not needed to prove the workflow. A College-owned production service would likely require decisions or work in these areas:

- formal product/service owner;
- authoritative curriculum/admissions data owner;
- information governance / DPIA;
- accessibility review against the College standard;
- supported browser/device matrix;
- cyber/security review and dependency maintenance;
- authenticated staff workflows if adviser features use real data;
- appropriate audit/observability without logging student grades unnecessarily;
- formal release environments and rollback ownership;
- user support route and service level;
- integration strategy with College systems, if desired;
- a documented policy for stale/changed course requirements.

None of those should be inferred to exist merely because the demo works.

## Engineering principles to preserve

- **Human verification before matching.**
- **Published evidence before rule changes.**
- **No fabricated eligibility for unencoded rules.**
- **Non-grade requirements remain visible.**
- **Student data minimisation.**
- **Matching logic remains testable independently of the UI.**
- **Course data remains separate from matching code.**
- **A failed OCR path must not prevent manual entry.**

For deeper technical detail, continue with [`ARCHITECTURE.md`](ARCHITECTURE.md).

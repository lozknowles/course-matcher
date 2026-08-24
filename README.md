# Course Match — Lincoln College demonstration

A self-contained, privacy-first prototype for GCSE results day and enrolment conversations. It supports two complementary workflows:

1. **Student view** — upload/photograph results or enter grades manually, verify every extracted grade, add subject/career interests, and receive transparent course matches.
2. **Tutor / adviser view** — select a course and triage an anonymised cohort to identify students worth a human conversation.

> **Important:** This is an independent demonstration. It is not an official Lincoln College service, does not make admissions decisions, and is not endorsed by Lincoln College.

## Why this exists

The prototype explores a practical enrolment use case: a student arrives with results on paper, as a screenshot, PDF, scan or electronic file. Instead of manually searching every course page, the tool can assist with extraction and apply a small set of explicitly encoded published rules. It always shows the evidence and keeps non-grade requirements visible.

## Current features

- Plain HTML/CSS/JavaScript; no framework and no backend.
- Manual GCSE grade entry.
- Image/screenshot OCR using **Tesseract.js**, executed locally in the browser.
- PDF text extraction using **PDF.js**; scanned PDF pages fall back to local OCR.
- Mandatory human verification of extracted grades before matching.
- Combined Science double-award support (`5-5`) so two GCSE outcomes are counted correctly.
- Multi-interest and career keyword filtering.
- Green / amber / red result bands with individual requirement checks.
- Explicit warnings for interviews, references, portfolios, DBS, placements and other non-grade requirements.
- Adviser reverse-matching against an anonymised synthetic cohort or simple CSV import.
- Direct links to official Lincoln College pages for every encoded course.
- Links to **all published school-leaver subject areas** even where this demo has not encoded a specific course rule.
- No upload API and no server-side storage.

## Golden demonstration case

The built-in **Load demo student** button uses the repeatable profile agreed for the prototype:

| Subject | Grade |
|---|---:|
| Mathematics | 5 |
| English Language | 4 |
| English Literature | 3 |
| Geography | 3 |
| Physics | 2 |
| Combined Science | 5 |

The single `5` for Combined Science is intentionally treated conservatively as one evidenced grade. If the actual result is a double award, it should be entered as a pair such as `5-5`. This makes the ambiguity visible instead of silently inflating the GCSE count.

## Course-data policy

The encoded course rules are a **dated snapshot checked on 24 August 2026** against public Lincoln College pages. Lincoln College itself says grades vary by course and the specific course page should be checked.

The matcher deliberately distinguishes between:

- **Encoded rules** — criteria the prototype can test and explain.
- **Human-only conditions** — interviews, references, portfolios, DBS, placements, motivation, fitness/suitability and similar checks.
- **Unencoded courses/subjects** — surfaced as official links, but never given a fabricated eligibility verdict.

This is safer than pretending the entire College catalogue can be reduced to GCSE numbers.

## Run locally

The core manual-entry and matching UI has no build step:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

### Enable local OCR and PDF processing

The runtime must not depend on CDNs or external APIs, so OCR/PDF libraries are copied into `vendor/` before deployment:

```bash
npm install
npm run vendor
python3 -m http.server 8000
```

`npm run vendor` copies the pinned Tesseract.js, English OCR language data and PDF.js browser assets from `node_modules` into the static `vendor/` directory. Once prepared, OCR/PDF processing happens locally in the browser and does not require a runtime network call.

## Test

```bash
npm test
```

The tests cover OCR-style text parsing, Combined Science counting, the golden student, representative Level 2/3 outcomes, and interest filtering.

## Static deployment

After running `npm install && npm run vendor`, copy these files to any static web root:

- `index.html`
- `styles.css`
- `app.js`
- `matcher-core.js`
- `courses.js`
- `vendor/`

For the existing demonstration URL, deploy them under:

```text
/lincoln-course-match/
```

No backend routes are required.

## CSV format for adviser mode

The first two columns should be `id` and `interest`; subsequent headings are treated as qualification subjects:

```csv
id,interest,Mathematics,English Language,Combined Science,Geography
S-101,Computing,5,4,5-5,3
S-102,Sport,3,3,3-3,4
```

Use anonymised IDs for demonstrations. Do not load identifiable student data into an unofficial prototype without appropriate College approval and data governance.

## Project boundaries

- The app provides indicative matching, not offers or admissions decisions.
- OCR output is never trusted without human review.
- Course rules are source-linked and date-stamped.
- The code does not scrape Lincoln College at runtime.
- The project does not modify or depend on LocalWalks, Agent Control, or any other project.

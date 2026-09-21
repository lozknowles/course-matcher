# Demo 8 — Student Portal & Enrolment Workspace

Demo 8 is an independent, synthetic Lincoln College prototype that explores a lower-navigation enrolment journey. It does not connect to ProSolution, the DfE Education Record service, email, IPS or a card printer.

## Purpose

The demo tests whether enrolment can be presented as a focused workspace rather than asking learners or staff to traverse a broad MIS menu. The prototype keeps only the steps that matter to a typical enrolment:

1. choose the evidence route;
2. confirm existing personal/contact information;
3. use a DfE Education Record where available, or photograph/upload results;
4. verify qualification evidence;
5. review only unresolved enrolment items;
6. trigger the common completion actions.

## DfE Education Record route

The DfE-supported journey is represented accurately rather than as a fictional "scan a QR from the student's phone" flow.

Current public DfE guidance says that providers can request a learner's education record through an integrated MIS or the View Education Records service. The learner receives the request in the DfE Education Record app and chooses to share. The provider can then view/download the shared record; supported MIS vendors may integrate through the DfE API.

The QR shown by this prototype is deliberately labelled **illustrative only**. It is not a live DfE token and the public demo does not hold DfE Sign-in credentials.

Official references checked 21 September 2026:

- https://view-education-record.education.gov.uk/
- https://view-education-record.education.gov.uk/about/providers
- https://view-education-record.education.gov.uk/about/providers/get-education-records
- https://view-education-record.education.gov.uk/about/pupils-parents/step-by-step

## Results-photo route

The fallback photo/upload journey reuses Course Match's locally vendored Tesseract.js runtime and the same conservative `parseResultsText` parser from `matcher-core.js`.

- image OCR runs in the browser;
- no OCR API receives the image;
- text/CSV can also be loaded;
- the extracted subject/grade rows remain editable;
- the Continue action stays disabled until the user explicitly confirms that every grade has been checked against the source.

This is decision support only. OCR output is never treated as authoritative evidence by itself.

## Completion actions

The review workspace demonstrates direct access to:

- **Send student agreement** — simulated only;
- **Print learner lanyard / pass card** — simulated card preview only.

The prototype deliberately does not claim that these actions are available through a documented ProSolution API. A production implementation must use supported College integrations, documented ProSolution imports/APIs, or an explicitly approved supervised route.

## Data and privacy

All records in Demo 8 are synthetic. The demo has no application server or database and no live learner-data endpoint. Camera/photo processing happens in the browser using the existing local OCR bundle.

The College should still complete the normal DPIA, accessibility, security, retention and records-management reviews before any production adoption.

## Validation

Run:

```bash
npm ci
npm test
npm run vendor
node --check student-portal.js
```

Then serve the repository over HTTP and test:

- 1440px desktop;
- 390px mobile;
- DfE demo request/share route;
- demo results load;
- real image/photo OCR;
- grade edit + mandatory verification;
- agreement/pass completion gate;
- reset/restart;
- keyboard navigation and visible focus.

The production deployment helper includes Demo 8 files and post-deployment content checks.

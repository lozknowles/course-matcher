# Lincoln College student-success demonstrations

This small static application contains Course Match, 42-day learner-intervention decision support, and a synthetic automated Student Change Request workflow demonstration. Course matching is one capability in the suite, not the whole proposition.

It has four demonstration journeys:

1. **Student view** — enter or upload results, verify every extracted grade, then choose either Quick Match or Guided Match.
2. **Tutor / adviser view** — select a course and triage an anonymised cohort to identify students who may be worth a human conversation.
3. **42-Day Student Fit & Retention - Swap Not Drop Decision Support** — complement the College's established 2026/27 process by starting with why a learner is struggling, selecting the right intervention, monitoring progress and showing course alternatives only when transfer is appropriate.
4. **Automated Student Change Request** — a synthetic, interface-faithful demonstration of an agent carrying out the observed staff workflow: navigate to Student Change Request, set Next Stage to Accepted, open a Change Request row, review the proposed field change, click Accept, confirm the changed value on Student Details, click Save & Close, and visibly reconcile the request disappearing from the To Do list. A labelled on-screen cursor moves to each target and emits click pulses so the automation is visibly performing the existing human UX steps rather than simply changing state in the background.

> **Status:** independent demonstration/prototype. It is not an official Lincoln College service and has no live ProSolution connection.

## Current live demonstration

The demonstration is intended to be hosted under:

```text
https://lozknowles.com/lincoln-course-match/
```

The Automated Change Request page is:

```text
https://lozknowles.com/lincoln-course-match/automated-change-request.html
```

The canonical source repository is:

```text
https://github.com/lozknowles/course-matcher
```

## Automated Change Request prototype boundary

The workflow is based on the observed ProSolution screens and interaction sequence, but every learner name, student reference, phone number, email address, Change Request ID and course/offering value in the demo is synthetic. No personally identifiable learner data from the observed screens is reproduced.

The prototype deliberately shows the existing human endeavour being automated through the UX:

```text
Student Change Request
  -> cursor to Next Stage
  -> Accepted
  -> cursor to Change Request row
  -> open/double-click
  -> cursor to changed value
  -> review
  -> cursor to Accept
  -> Accept
  -> Student Details
  -> cursor to changed field
  -> verify accepted value
  -> cursor to Save & Close
  -> Save & Close
  -> request disappears from To Do list
  -> queue count + audit reconciliation update
```

The prototype is not evidence that unattended production UI automation is approved. A production implementation would require CIS-approved credentials/roles, a supported test environment, deterministic selectors or another robust supported interface, timeout/failure handling, idempotency, full audit evidence, and read-back/reconciliation before any live use.

## Testing and deployment

The repository remains plain HTML/CSS/JavaScript. Existing Course Match and retention tests run through `npm test`; CI also rebuilds the locally vendored OCR/PDF runtime. The production deployment helper now includes and verifies `automated-change-request.html` as part of the demo package.

Before deployment:

```bash
npm ci
npm test
npm run test:links
npm run vendor
```

The deployment helper refuses a non-main or dirty checkout and backs up the existing production demo before replacing the route.

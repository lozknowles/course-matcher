# Digital Student Journey presentation correction

Baseline: f4cb98e. Restores yellow panels, red frames, an offset hero outline,
overlapping numbered badge and the previously used licensed Kalam heading font.
Navy remains in the application shell and action buttons. Abstract teal poster
decoration is removed. Private photographs were inspected locally only.

The ten-stage model, matching engine, OCR capture, DfE flow, enrolment gates and
availability data are unchanged. Discover displays the complete existing verified
qualification examples rather than truncating each level to four items.

Validation on 22 September 2026:

- All 70 unit tests pass, including new presentation checks.
- Browser assertions pass at 1440 and 390 pixels for all ten stages; Discover also
  passes at 320 pixels. Checks cover yellow fills, red frames, offset hero frame,
  level sequence and horizontal overflow. No browser console errors observed.
- Course Match and the ten-stage chooser exercised in the browser.
- Fresh desktop, mobile, Levels and Careers screenshots inspected. The yellow
  fill, separate red hero frame, red badge and black handwritten heading match
  the private wall-reference direction. The application retains its usable forms
  and responsive content rather than copying the wall's physical arrangement.
- All 60 official links pass.
- The 118-file public payload was checked against the ten private references:
  no matching image bytes or private reference filenames found.

`scripts/journey-visual-probe.js` contains a read-only browser assertion expression.
For browser tools that evaluate expressions, remove its introductory comment and
trailing semicolon, then invoke the arrow function. Run it in each loaded stage
at desktop and mobile widths. Screenshot review remains required alongside it.

Only the new font and its OFL licence are added as assets. Release using the
existing guarded deployment tooling after CI; these checks do not waive any gate.

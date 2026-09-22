# Course availability snapshot and qualification-level guide

This addition uses two pieces of user-supplied Lincoln College evidence dated 21 September 2026: the first photographed page of the ProResource/ProSolution capacity sheet and the qualification-level artwork.

## Capacity

`availability-data.js` preserves the photographed values separately from `courses.js` and `matcher-core.js`. Capacity never makes a learner academically eligible and never changes a grade-rule result.

The snapshot stores planned and enrolled counts separately for 16–18 and 19+ learners. A negative variance is presented as places in that photographed snapshot; zero/positive variance is shown as full/at plan. Where the sheet shows no plan but active enrolments, the UI says staff check rather than inventing capacity.

Only two current encoded matcher courses are mapped from page 1 because their correspondence is sufficiently clear:

- `skills-health-care` → `SPL0204AA1` Skills for Health and Social Care - Lincoln
- `sport-active-l2` → `SPL0310AA1` Introduction to the Sport and Active Leisure Industry Level 2

Unmapped matches explicitly say that availability is not on the supplied page. More photographed pages can extend the snapshot and mappings without changing matching rules.

## Qualification-level guide

`level-guide-data.js` reconstructs the clearly readable items in the supplied artwork. The UI presents a rising Entry-to-Level-6 ladder and allows a learner to jump from a matched course to its level explanation.

The guide is explanatory only. It does not rank courses or satisfy entry requirements. The Level 3 photograph is cropped, so only the clearly readable examples — Advanced Apprenticeship, A Levels and T Levels — are included.

## Release checks

The regression suite verifies the age-specific capacity calculations, the separation of capacity from eligibility, and that the level guide does not invent the cropped Level 3 examples. The deployment allowlist and public verification include both new data modules.

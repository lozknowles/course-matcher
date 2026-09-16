# Lincoln College demonstrations 6 and 7

Demo 6 (`enrolment-dashboard.html`) implements the supplied enrolment-dashboard image using the existing Lincoln navy, cream, pink and teal palette. Demo 7 (`student-hub/careers.html`) completes and publishes the previously separate career-pathway prototype. Both are linked from the seven-card launch page.

## Demo 6

The two illustrative intakes contain 240 and 210 entirely fictional applications. Campus filters, current-stage totals, programme capacity, search, pagination, review checklists and CSV exports use the same in-memory records. Adding a sample learner and moving them through review, offer and enrolment updates the intake totals and capacity. Reload or Reset restores the initial records. There is no persistence or ProSolution connection.

Offers include enrolled learners. Pending review combines Applied and In review. The trend shows cumulative applications by application month and the subset currently enrolled; it is not an enrolment-event timeline. Programmes, places and names are illustrative, not the college's current admissions inventory.

## Demo 7 sources and limits

- Skills England API snapshot retrieved 11 September 2026: 1,287 occupations, 15 routes and 75 directed progression links from 15 fetched occupations. The occupation catalogue is broader than the fetched progression coverage. Missing progression is labelled explicitly, and never inferred from occupation level or title.
- The recovered pathway implementation came from local revision `09a06bf`, following implementation `b1183dac950e60b3c49c3271d51c9b65ca1e87df`. The salary references were refreshed from the official ONS workbooks on 16 September 2026, with source cells and file hashes retained.
- ONS ASHE Tables 15 and 14, 2025 provisional: workplace-based median annual gross pay for full-time employee jobs, matched by exact four-digit SOC 2020. East Midlands figures take priority; a UK median from the same edition is clearly labelled when a regional median is unavailable. These describe broader occupation groups, not starting pay or a guaranteed salary for the selected role.
- There are 232 published East Midlands medians and 382 UK medians across 412 occupation groups in each reference. The former importer excluded 128 published regional medians because the corresponding CV cell contained `.` (quality score unavailable). These medians are retained with an explicit caution, without inventing a CV. Suppressed, blank and high-CV medians remain unavailable. The UK police correction is preserved.
- Salary coverage is 1,060 of 1,287 Skills England occupations: 691 use East Midlands figures and 369 use UK figures. Of the remainder, 207 have no supplied SOC 2020 mapping and 20 have no published median in either reference. No title-based or broader-code salary matching is used. Independent raw XLSX XML checks verified all 824 occupation records against both pay and CV workbooks.
- ONS labour demand, January 2017–July 2026 edition, published 21 August 2026 and downloaded 16 September 2026: 412 East Midlands monthly SOC groups, 411 Lincoln quarterly groups and 412 Newark and Sherwood quarterly groups. The missing Lincoln SOC 1256 row is unavailable, not zero.
- Every recruitment observation retains its source cell, period, status and suppression marker. An independent raw XLSX XML audit verified all 5,764 observations and 1,235 geography/SOC joins.
- ONS labels recruitment figures statistics in development. Source coverage changes, imputation and suppression affect recent observations. Latest detailed district figures are suppressed. Earlier published local figures remain visible with their actual dates. Monthly regional and quarterly district counts are not directly comparable.
- Recruitment figures count new online adverts, not live vacancies, unique jobs, all hiring or a forecast. The Reed link opens a role-specific external search within 20 miles of Lincoln. No live jobs feed is connected.

Source pages:

- [Skills England API](https://occupational-maps.skillsengland.education.gov.uk/public-api/)
- [ONS ASHE Table 15](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/regionbyoccupation4digitsoc2010ashetable15)
- [ONS ASHE Table 14](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/occupation4digitsoc2010ashetable14)
- [ONS labour demand by SOC 2020](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/labourdemandvolumesbystandardoccupationclassificationsoc2020uk)

Recruitment workbook SHA-256: `59876a7e480e5b654188401cb1466f2a0ca72f404c31a7c7c987f9bb567cce4e`.

To repeat extraction, install openpyxl in a suitable Python environment and run `python scripts/import-ons-demand.py <workbook.xlsx> student-hub/ons-demand-reference.json`. Recheck the source edition, headers, geography definitions and quality notes before using a newer release; the importer deliberately fails when its expected edition changes.

For salaries, download the official 2025 provisional Table 14 and Table 15 ZIP files, then run `python scripts/import-ashe-pay.py <download-directory> <retrieved-at-ISO-timestamp>`. The importer reads the full-time median in column D of the annual gross pay and corresponding CV workbooks, verifies the code/title joins, and requires 412 distinct four-digit SOC groups for each geography. It deliberately targets this source edition.

## Validation and delivery

Run `npm test` and serve the repository with a local HTTP server. The release uses only local assets and ES modules. New Bootstrap Icons are version 1.13.1 with source manifests and MIT licences alongside them.

The existing full-suite deployment allowlist includes the new assets. The September 2026 release instead uses `scripts/deploy-scoped.py` with an explicit manifest, a snapshot of live file hashes and an immutable backup. It replaces only the listed files and verifies every untouched file. Commit publication alone does not establish that the site is live; retain the deployment receipt and verify the public pages afterwards.

Browser checks cover desktop and 390/320 CSS-pixel layouts, the complete synthetic application journey, filters, pagination, empty results, career navigation/history, invalid occupation links, exact regional pay, suppressed local recruitment and a cached reload under offline network emulation. These are browser checks, not physical handset qualification. See `design-qa.md` for visual findings.

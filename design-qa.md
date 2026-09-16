# Student Course Match design QA

## Evidence

- Source visual truth: `C:\Users\Loz\AppData\Local\Temp\codex-clipboard-9f85b468-3136-4e03-9352-702fc5341746.png`
- Source pixels: 240 × 320. The source is a perspective photograph of a 16:9 desktop monitor, so exact pixel and viewport normalization is not possible.
- Implementation URL: `http://127.0.0.1:8766/?mode=student&qa=final`
- Implementation screenshot: `design-qa-implementation.png`
- Implementation pixels: 1189 × 1679 at the in-app browser's 1189 CSS-pixel desktop width and 1× capture density.
- Combined comparison screenshot: `design-qa-comparison.png` (1204 × 912).
- State: student view, step 1, empty results entry.

## Findings

No actionable P0, P1 or P2 differences remain for the requested interpretation.

- Fonts and typography: the student workspace uses compact Arial UI text, blue section hierarchy and uppercase micro-labels consistent with the photographed record system. Larger Lincoln College display type remains outside the workspace to preserve the demonstration brand.
- Spacing and layout rhythm: the blue title bar, horizontal tabs, four-column status record, bordered content groups and bottom action area reproduce the source's dense desktop rhythm. The form becomes a single-column flow at narrow widths rather than shrinking into unreadable desktop fields.
- Colors and visual tokens: the implementation carries over the source's medium-blue title bars, pale blue-grey chrome, white field groups and fine grey dividers. Lincoln pink, teal and navy remain limited to the surrounding branded shell and meaningful accents.
- Image quality and assets: the supplied photograph is used only as design evidence. The existing Lincoln College wordmark remains sharp and unchanged; the record workspace requires no new raster assets or substitute drawn icons.
- Copy and content: labels are student-facing rather than copying staff-only Student Details fields. Academic year, application stage, evidence source and submission status provide the same record context without implying a live ProSolution connection.
- Focused comparison: the record header, tab strip, status fields and first form group were readable in the combined capture and matched the source's defining visual structure. No additional crop was necessary.

## Comparison history

1. First rendered pass retained the standard 390px marketing hero, pushing the ProSolution-inspired workspace too far below the fold (P2).
2. The student-only hero was reduced to 180px with tighter internal padding. The final combined capture places the record workspace in the first viewport while retaining Lincoln branding.
3. Post-fix comparison found no remaining actionable P0, P1 or P2 issue.

## Interaction and regression checks

- Core OCR/photo, PDF, verification, Quick Match and Guided Match controls retain their original IDs and event wiring.
- Direct `?mode=student` routing opens the redesigned state for deterministic review.
- Node syntax validation and the complete automated regression suite pass.

## Follow-up polish

- P3: a future iteration could shorten the surrounding College header specifically on very small screens, provided the official-link navigation remains accessible.

final result: passed

## Demo 2 student-detail mockup — 9 September 2026

Reference: C:/Users/Loz/Documents/Codex/2026-09-07/th/outputs/evidence/PS-NAV-008.png and screen-registry.md.
Implementation capture: C:/Users/Loz/Documents/Codex/2026-09-08/referenced-chatgpt-conversation-this-is-an/outputs/student-details-preview.png.

Compared Personal screen at 1071 x 873. Revised after user feedback to the compact 782px grey desktop record, three personal-detail columns, two address panels, full second-level navigation and bottom actions. Intentional differences: fictional values replace redactions; a small synthetic-data notice and return action are added; write controls are disabled. Narrow viewport stacks address panels.

Verified in browser: synthetic reference opens correct learner; QoE retains source grades; Apps & Enqs retains course and matching evidence; Close returns to unchanged results. No browser error logs. Node syntax check and 28 existing tests passed. Remaining P3: native tab bevels and exact dropdown chrome are approximations; not a pixel-identical ProSolution client.

final result: passed

## Demo 5 — Data Quality Automation, 9 September 2026

Sources: PS-NAV-002 student list and PS-NAV-008 Personal detail capture. Uses compact grey desktop panels, blue selected rows/tabs, original-style column order and paired addresses with fictional data. Browser inspected list, field-correction state and AutoEmail draft. Intentional variation: automation controls/audit sidebar and synthetic banner.

Full browser run completed all 20 records: 16 corrected, four mobile exceptions, four retained drafts, zero sent emails. Reopened SYN-004 draft correctly addressed to learner4@example.com. Pause/Resume observed working. Console error log empty. 31 tests passed. Final small visual fix: wrap AutoEmail message text rather than horizontal scrolling.

final result: passed


---

# Visual and interaction QA

## Visual targets and comparison

Demo 6 was compared side by side in the same image inspection with the original 1672 × 941 generated enrolment dashboard (`exec-a73c4486-8a2e-40b6-b044-8146f0887c19.png`). It retains the navigation rail, four metrics, wide trend/narrow pipeline row and recent-applications/capacity row. The user-requested Lincoln look replaces the original blue neon treatment with the existing navy, cream, magenta and teal system and supplied college logo.

Demo 7 was compared in the same image inspection with the recovered 1487 × 1058 selected career concept (`exec-7064057d-9374-4d02-9d61-de64b71c897f.png`). It preserves the white search rail, cream workspace, magenta selected occupation, blue neighbouring nodes, curved directed connections and pay/jobs row. The completed recruitment panel sits below the original composition.

Intentional adaptations: real published occupation titles and partial graph counts replace concept copy; explicit graph/list buttons expose every cached neighbour; route filtering replaces a fictional location-based occupation search; dated ONS pay and recruitment replace placeholders. Demo 6 uses a coherent synthetic cohort rather than the image's unrelated headline numbers. Its trend definition and current-stage pipeline are explicit. These changes serve the requested functional demonstrations.

## Checks and fixes

- Desktop checks at 1672 × 941 and 1487 × 1058; mobile checks at 390 × 844 and 320 CSS pixels. No horizontal page overflow in either demo. Wide application tables scroll within their panel.
- Compacted the enrolment header and capacity rows to restore the reference's dashboard density. Retained visible labels, clear hierarchy and keyboard focus rings.
- Mobile navigation, the new-application dialog, sample review, programme-to-applications links and empty search results are usable. Career selection scrolls to the selected role; graph nodes stack without clipping. The local recruitment panel retains its area, dates and suppression label at narrow widths.
- Complete synthetic journey verified: 240/168/120/72 starting totals; adding and enrolling one sample results in 241/169/121/72. The offer button is disabled until all three fictional checks are ticked.
- Campus filters, intake switching, pagination, programme filtering and CSV export action checked. CSV quoting and formula protection are covered in automated tests; the in-app browser's download-event listener timed out, so it is not recorded as an independently inspected downloaded file.
- Career search, route filtering, result pagination, graph/list views, native directed neighbours and role-specific Reed URLs checked. Fixed initial browser-history restoration and verified Software developer → DevOps engineer → Back returns to Software developer.
- An invalid occupation ID shows an actionable message and recovers on selecting a result. 3D artist shows unfetched progression and unavailable pay rather than invented data.
- Software developer shows £49,685 for the wider East Midlands SOC group and 388 new adverts in July 2026. Lincoln and Newark show latest-period suppression with earlier published values of 20 and 17 for October–December 2025 respectively.
- Cached career shell, graph, pay and recruitment loaded during browser offline network emulation. Connectivity was restored afterwards. This is an emulated browser check, not physical offline/device qualification.
- No application console errors during ordinary online interaction. Synthetic values stay local to the page. Public source attribution, dates and limitations remain visible.

No unresolved P0, P1 or P2 visual/interaction findings. The small supplied logo remains the existing source asset. Local QA screenshots and the independent ONS XML audit are retained with the release evidence; public deployment is qualified separately in the delivery record.

final result: passed

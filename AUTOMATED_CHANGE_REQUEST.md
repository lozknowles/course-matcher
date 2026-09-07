# Automated Student Change Request demonstration

This synthetic prototype mirrors the observed ProSolution Student Change Request workflow while deliberately excluding all real learner data.

The automation is intentionally visible. A labelled agent cursor moves to each control and click pulses show the same user-interface work a staff member currently performs:

1. Navigate to Student Change Request.
2. Move the cursor to **Next Stage** and select **Accepted**.
3. Move to the next Change Request row and open it.
4. Move to the proposed changed field and review the current and changed values.
5. Move to **Accept** and click it.
6. On the resulting Student Details record, move to the changed field and visibly confirm the accepted value.
7. Move to **Save & Close** and click it.
8. Return to the main queue and show the Change Request ID disappearing.
9. Update the visible queue count and audit/reconciliation record.

Every learner name, student reference, phone number, email address, Change Request ID and course/offering value used by the demo is synthetic. The page has no live ProSolution connection and performs no real write-back.

A production version should be qualified first in Lincoln's non-production/test ProSolution system. It would also require CIS-approved authentication and roles, stable selectors or another supported interface, timeouts and recovery, idempotency/replay protection, audit evidence and read-back/reconciliation before any live use.

Live-demo target: `https://lozknowles.com/lincoln-course-match/automated-change-request.html`

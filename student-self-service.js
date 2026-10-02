const stages = ['home', 'details', 'results', 'review'];
function showStage(focus = false) {
  const requested = location.hash.slice(1);
  const stage = stages.includes(requested) ? requested : 'home';
  for (const id of stages) document.getElementById(id).hidden = id !== stage;
  document.querySelectorAll('[data-stage]').forEach(link => {
    if (link.dataset.stage === stage) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  });
  if (focus) document.getElementById(`${stage}-title`).focus();
}
addEventListener('hashchange', () => showStage(true));
showStage();
document.getElementById('sample-evidence').addEventListener('click', () => {
  document.getElementById('evidence-status').textContent = 'Fictional GCSE Mathematics certificate added to this walkthrough. Awaiting review; no file uploaded.';
  document.getElementById('review-evidence').textContent = 'GCSE Mathematics (grade 7) — fictional certificate awaiting staff review.';
});
document.getElementById('confirm-demo').addEventListener('change', event => {
  document.getElementById('submit-demo').disabled = !event.target.checked;
});
document.getElementById('submit-demo').addEventListener('click', () => {
  document.getElementById('submission-status').textContent = 'Simulation complete. In the proposed service, permitted changes and evidence would enter the appropriate approval queues. Nothing was sent to ProSolution; enrolment is not confirmed.';
});

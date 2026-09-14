import { DEMO_SCENARIOS, evaluateFunding, RULESET } from './funding-core.js';

const $ = (id) => document.getElementById(id);
const form = $('funding-form');
const resultCard = $('result-card');

function profileFromForm() {
  return {
    age: Number($('age').value || 0),
    ehcp: $('ehcp').checked,
    residency: $('residency').value,
    courseLevel: $('courseLevel').value,
    entitlement: $('entitlement').value,
    employment: $('employment').value,
    benefit: $('benefit').value,
    annualGross: Number($('annualGross').value || 0),
    ucClaim: $('ucClaim').value,
    ucMonthlyEarnings: Number($('ucMonthlyEarnings').value || 0)
  };
}

function setProfile(p) {
  $('age').value = p.age;
  $('ehcp').checked = Boolean(p.ehcp);
  $('residency').value = p.residency;
  $('courseLevel').value = p.courseLevel;
  $('entitlement').value = p.entitlement;
  $('employment').value = p.employment;
  $('benefit').value = p.benefit;
  $('annualGross').value = p.annualGross;
  $('ucClaim').value = p.ucClaim;
  $('ucMonthlyEarnings').value = p.ucMonthlyEarnings;
  render();
}

function clearTree() {
  document.querySelectorAll('.node').forEach((n) => n.classList.remove('active', 'pass', 'warn', 'fail'));
}

function mark(stage, key, cls = 'active') {
  const node = document.querySelector(`.stage[data-stage="${stage}"] .node[data-key="${CSS.escape(String(key))}"]`);
  if (node) node.classList.add(cls);
}

function renderTree(result) {
  clearTree();
  result.path.forEach((step, i) => mark(step.stage, step.value, i === result.path.length - 1 ? 'active' : 'pass'));
  mark('outcome', result.code, result.code === 'NOT_ELIGIBLE' ? 'fail' : (result.code === 'MANUAL' ? 'warn' : 'active'));
}

function render() {
  const result = evaluateFunding(profileFromForm());
  renderTree(result);
  $('result-label').textContent = result.label;
  $('result-reason').textContent = result.reason;
  $('status-pill').textContent = `${RULESET.label} · ${result.code}`;
  resultCard.dataset.tone = result.tone;
  $('evidence').innerHTML = result.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const flags = result.flags || [];
  $('flags').hidden = flags.length === 0;
  $('flags').innerHTML = flags.map((x) => `<div>${escapeHtml(x)}</div>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function buildScenarioButtons() {
  const strip = $('scenario-strip');
  DEMO_SCENARIOS.forEach((scenario) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = scenario.label;
    btn.addEventListener('click', () => setProfile(scenario.profile));
    strip.appendChild(btn);
  });
}

function renderRuleBox() {
  $('ruleset-chip').textContent = `${RULESET.id} · configurable demonstration rules`;
  $('rulebox').innerHTML = `
    <div><small>Adult earnings threshold</small><strong>£${RULESET.annualEarningsThreshold.toLocaleString('en-GB')}</strong><small>Operational demo value — confirm with Lincoln/GLCCA.</small></div>
    <div><small>UC AET · sole adult</small><strong>£${RULESET.ucAetSingleMonthly.toLocaleString('en-GB')}/month</strong><small>Current DWP AET used as configurable input.</small></div>
    <div><small>UC AET · joint claim</small><strong>£${RULESET.ucAetJointMonthly.toLocaleString('en-GB')}/month</strong><small>Current DWP AET used as configurable input.</small></div>
    <div><small>Residency gate</small><strong>${RULESET.residencyYears} years</strong><small>Exceptions require evidence and current-rule review.</small></div>`;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
$('reset').addEventListener('click', () => setProfile(DEMO_SCENARIOS[2].profile));
$('print').addEventListener('click', () => window.print());

buildScenarioButtons();
renderRuleBox();
setProfile(DEMO_SCENARIOS[2].profile);

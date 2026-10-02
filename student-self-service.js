import { translations, resolveLanguage, directionFor } from './student-self-service-languages.js?v=20261002-languages';
const stages = ['home', 'details', 'results', 'review'];
const preferenceKey = 'lincoln-student-portal-language';
const selector = document.getElementById('portal-language');
let language = 'en';
let hasEvidence = false;
let submitted = false;
function renderStatuses() {
  const t = translations[language];
  for (const [id, key] of [
    ['evidence-status', hasEvidence ? 'statusAdded' : 'statusEmpty'],
    ['review-evidence', hasEvidence ? 'reviewAdded' : 'reviewEmpty'],
    ['submission-status', submitted ? 'submitDone' : 'submitEmpty']
  ]) {
    const node = document.getElementById(id);
    node.textContent = t[key]; node.lang = language; node.dir = directionFor(language);
  }
}
function changeLanguage(value, announce = false) {
  language = resolveLanguage(value);
  const t = translations[language];
  document.documentElement.lang = language;
  document.documentElement.dir = directionFor(language);
  document.title = `${t.portal} | Lincoln College`;
  selector.value = language;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t[node.dataset.i18n];
    node.lang = language; node.dir = directionFor(language);
  });
  renderStatuses();
  try { localStorage.setItem(preferenceKey, language); } catch { /* Demo still works when storage is disabled. */ }
  if (announce) document.getElementById('language-status').textContent = `${t.language}: ${selector.selectedOptions[0].textContent}`;
}
let savedLanguage = 'en';
try { savedLanguage = localStorage.getItem(preferenceKey) || 'en'; } catch { /* Use English when storage is unavailable. */ }
changeLanguage(savedLanguage);
selector.addEventListener('change', event => changeLanguage(event.target.value, true));
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
  hasEvidence = true;
  renderStatuses();
});
document.getElementById('confirm-demo').addEventListener('change', event => {
  document.getElementById('submit-demo').disabled = !event.target.checked;
});
document.getElementById('submit-demo').addEventListener('click', () => {
  submitted = true;
  renderStatuses();
});

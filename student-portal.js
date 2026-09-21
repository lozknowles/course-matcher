import { parseResultsText } from './matcher-core.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const DEMO_RESULTS_TEXT = `EXAMINATION RESULTS
Mathematics 6
English Language 5
Biology 6
Chemistry 6
Physics 5`;

const DFE_QUALIFICATIONS = [
  { subject: 'Mathematics', grade: '6', level: 'GCSE' },
  { subject: 'English Language', grade: '5', level: 'GCSE' },
  { subject: 'Biology', grade: '6', level: 'GCSE' },
  { subject: 'Chemistry', grade: '6', level: 'GCSE' },
  { subject: 'Physics', grade: '5', level: 'GCSE' }
];

const state = {
  route: 'dfe',
  detailsConfirmed: false,
  evidenceSource: '',
  qualifications: [],
  agreementSent: false,
  passPrinted: false
};

function showScreen(name) {
  $$('.portal-screen').forEach(screen => screen.classList.toggle('active', screen.dataset.screen === name));
  $$('.side-step').forEach(button => button.classList.toggle('active', button.dataset.step === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setRoute(route) {
  state.route = route;
  showScreen('details');
}

$$('[data-route]').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.route)));
$$('[data-go]').forEach(button => button.addEventListener('click', () => showScreen(button.dataset.go)));
$$('.side-step').forEach(button => button.addEventListener('click', () => showScreen(button.dataset.step)));

$('#save-details').addEventListener('click', () => {
  state.detailsConfirmed = true;
  showScreen(state.route === 'dfe' ? 'dfe' : 'results');
});

function renderDfEResults() {
  $('#dfe-results-body').innerHTML = DFE_QUALIFICATIONS.map(item => `
    <tr>
      <td>${item.subject}</td>
      <td>${item.level}</td>
      <td><strong>${item.grade}</strong></td>
      <td>DfE record · demo</td>
    </tr>`).join('');
}

$('#create-dfe-request').addEventListener('click', () => {
  $('#demo-qr').classList.add('ready');
  $('#dfe-phone-state').textContent = 'Request ready';
  $('#simulate-share').disabled = false;
  $('#create-dfe-request').textContent = 'Demo request created';
});

$('#simulate-share').addEventListener('click', () => {
  renderDfEResults();
  $('#shared-record').classList.remove('hidden');
  $('#dfe-phone-state').textContent = 'Record shared';
  $('#simulate-share').textContent = 'Record shared';
  $('#simulate-share').disabled = true;
  $('#accept-dfe').disabled = false;
});

$('#accept-dfe').addEventListener('click', () => {
  state.evidenceSource = 'DfE Education Record';
  state.qualifications = DFE_QUALIFICATIONS.map(({ subject, grade }) => ({ subject, grade }));
  updateReview();
  showScreen('review');
});

function rowMarkup(row = { subject: '', grade: '' }) {
  const subject = escapeHtml(row.subject || '');
  const grade = escapeHtml(row.grade || '');
  return `<tr>
    <td><input class="result-subject" type="text" value="${subject}" aria-label="Qualification subject"></td>
    <td><input class="result-grade" type="text" value="${grade}" aria-label="Qualification grade"></td>
    <td><button class="row-remove" type="button" aria-label="Remove qualification">×</button></td>
  </tr>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderOcrRows(rows) {
  $('#ocr-results-body').innerHTML = rows.length ? rows.map(rowMarkup).join('') : rowMarkup();
  bindResultRowEvents();
  $('#grades-verified').checked = false;
  updateResultsAcceptance();
}

function bindResultRowEvents() {
  $$('#ocr-results-body .row-remove').forEach(button => button.addEventListener('click', () => {
    button.closest('tr').remove();
    if (!$('#ocr-results-body tr')) renderOcrRows([]);
    else invalidateGradeVerification();
  }));
  $$('#ocr-results-body input').forEach(input => input.addEventListener('input', invalidateGradeVerification));
}

function invalidateGradeVerification() {
  $('#grades-verified').checked = false;
  updateResultsAcceptance();
}

function rowsFromTable() {
  return $$('#ocr-results-body tr').map(row => ({
    subject: row.querySelector('.result-subject')?.value.trim() || '',
    grade: row.querySelector('.result-grade')?.value.trim() || ''
  })).filter(row => row.subject && row.grade);
}

function updateResultsAcceptance() {
  const ready = $('#grades-verified').checked && rowsFromTable().length > 0;
  $('#accept-results').disabled = !ready;
}

$('#grades-verified').addEventListener('change', updateResultsAcceptance);
$('#add-result').addEventListener('click', () => {
  $('#ocr-results-body').insertAdjacentHTML('beforeend', rowMarkup());
  bindResultRowEvents();
  invalidateGradeVerification();
});

function parseAndRender(text, statusPrefix = 'Extracted') {
  $('#ocr-text').value = text;
  const rows = parseResultsText(text);
  renderOcrRows(rows);
  $('#ocr-status').textContent = rows.length
    ? `${statusPrefix} ${rows.length} qualification${rows.length === 1 ? '' : 's'}. Check every grade against the source.`
    : 'No recognised subject/grade pairs found. Add or correct the results manually.';
}

$('#load-results-demo').addEventListener('click', () => {
  $('#photo-preview').classList.add('hidden');
  $('.camera-placeholder').classList.remove('hidden');
  parseAndRender(DEMO_RESULTS_TEXT, 'Loaded demo data with');
});

$('#take-results-photo').addEventListener('click', () => $('#results-photo').click());
$('#choose-results-file').addEventListener('click', () => $('#results-file').click());
$('#results-photo').addEventListener('change', event => {
  if (event.target.files[0]) processResultFile(event.target.files[0]);
});
$('#results-file').addEventListener('change', event => {
  if (event.target.files[0]) processResultFile(event.target.files[0]);
});

let currentPreviewUrl = '';

async function processResultFile(file) {
  $('#ocr-status').textContent = `Reading ${file.name}…`;
  try {
    if (/text|csv/.test(file.type) || /\.(txt|csv)$/i.test(file.name)) {
      parseAndRender(await file.text(), 'Read');
      return;
    }
    if (!file.type.startsWith('image/')) throw new Error('Use an image, text or CSV file in this demonstration.');

    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = URL.createObjectURL(file);
    $('#photo-preview').src = currentPreviewUrl;
    $('#photo-preview').classList.remove('hidden');
    $('.camera-placeholder').classList.add('hidden');

    const text = await ocrImage(file);
    parseAndRender(text, 'OCR found');
  } catch (error) {
    console.error(error);
    $('#ocr-status').textContent = `Could not read this file automatically: ${error.message}. You can still add the grades manually.`;
  } finally {
    $('#results-photo').value = '';
    $('#results-file').value = '';
  }
}

async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/tesseract/tesseract.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('local OCR vendor bundle is not installed'));
    document.head.appendChild(script);
  });
  return window.Tesseract;
}

function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => clearTimeout(timer));
}

async function ocrImage(source) {
  $('#ocr-status').textContent = 'Preparing local OCR…';
  const T = await ensureTesseract();
  const worker = await T.createWorker('eng', 1, {
    workerPath: './vendor/tesseract/worker.min.js',
    corePath: './vendor/tesseract-core',
    langPath: './vendor/tessdata',
    logger: message => {
      if (message.status) {
        const percent = message.progress ? ` ${Math.round(message.progress * 100)}%` : '';
        $('#ocr-status').textContent = `OCR: ${message.status}${percent}`;
      }
    }
  });
  try {
    const { data } = await withTimeout(worker.recognize(source), 120000, 'OCR timed out');
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

$('#accept-results').addEventListener('click', () => {
  state.evidenceSource = 'Photographed / uploaded results';
  state.qualifications = rowsFromTable();
  updateReview();
  showScreen('review');
});

function updateReview() {
  const hasEvidence = state.qualifications.length > 0;
  const item = $('#qualification-review');
  const source = state.evidenceSource || 'Evidence pending';

  $('#review-source-pill').textContent = source;
  $('#summary-evidence').textContent = hasEvidence ? `${state.qualifications.length} verified` : 'Pending';
  $('#qualification-review-text').textContent = hasEvidence
    ? `${state.qualifications.length} qualification${state.qualifications.length === 1 ? '' : 's'} accepted from ${source}.`
    : 'Choose DfE record or results capture.';
  item.classList.toggle('complete', hasEvidence);
  item.querySelector('span').textContent = hasEvidence ? '✓' : '•';
  $('#qualification-edit').textContent = hasEvidence ? 'Review' : 'Open';

  const outstanding = Number(!state.agreementSent) + Number(!state.passPrinted);
  $('#summary-outstanding').textContent = `${outstanding} action${outstanding === 1 ? '' : 's'}`;
  $('#complete-enrolment').disabled = !(hasEvidence && state.agreementSent && state.passPrinted);
}

$('#qualification-edit').addEventListener('click', () => {
  showScreen(state.evidenceSource === 'DfE Education Record' ? 'dfe' : 'results');
});

$('#send-agreement').addEventListener('click', () => {
  state.agreementSent = true;
  $('#agreement-status').textContent = 'Demo agreement marked as sent.';
  const item = $('#send-agreement').closest('.review-item');
  item.classList.remove('attention');
  item.classList.add('complete');
  item.querySelector('span').textContent = '✓';
  $('#send-agreement').textContent = 'Sent';
  $('#send-agreement').disabled = true;
  updateReview();
});

$('#print-pass').addEventListener('click', () => {
  $('#pass-dialog').showModal();
  state.passPrinted = true;
  $('#pass-status').textContent = 'Demo learner pass marked as printed.';
  const item = $('#print-pass').closest('.review-item');
  item.classList.remove('attention');
  item.classList.add('complete');
  item.querySelector('span').textContent = '✓';
  $('#print-pass').textContent = 'Printed';
  $('#print-pass').disabled = true;
  updateReview();
});

$('#complete-enrolment').addEventListener('click', () => showScreen('complete'));

$('#restart-demo').addEventListener('click', () => {
  state.route = 'dfe';
  state.detailsConfirmed = false;
  state.evidenceSource = '';
  state.qualifications = [];
  state.agreementSent = false;
  state.passPrinted = false;

  $('#demo-qr').classList.remove('ready');
  $('#dfe-phone-state').textContent = 'Waiting for request';
  $('#simulate-share').disabled = true;
  $('#simulate-share').textContent = 'Simulate learner sharing record';
  $('#create-dfe-request').textContent = 'Create demo request';
  $('#accept-dfe').disabled = true;
  $('#shared-record').classList.add('hidden');

  $('#agreement-status').textContent = 'Ready to send.';
  $('#pass-status').textContent = 'Ready to print / activate.';
  for (const id of ['send-agreement', 'print-pass']) {
    const button = $('#' + id);
    button.disabled = false;
    button.textContent = id === 'send-agreement' ? 'Send' : 'Print';
    const item = button.closest('.review-item');
    item.classList.remove('complete');
    item.classList.add('attention');
    item.querySelector('span').textContent = '!';
  }

  renderOcrRows([]);
  $('#ocr-text').value = '';
  $('#ocr-status').textContent = 'No results selected.';
  $('#photo-preview').classList.add('hidden');
  $('.camera-placeholder').classList.remove('hidden');
  updateReview();
  showScreen('welcome');
});

renderOcrRows([]);
updateReview();

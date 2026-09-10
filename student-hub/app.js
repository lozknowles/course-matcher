import { createDemoAdapter } from './adapter.js';
import { personas } from './data.js';
import { classifyChange, contactIssues, lessonState, normalise } from './core.js';

const app = document.querySelector('#app');
const picker = document.querySelector('#persona');
const dialog = document.querySelector('#edit-dialog');
const form = document.querySelector('#edit-form');
const input = document.querySelector('#edit-value');
const preview = document.querySelector('#edit-preview');
const message = document.querySelector('#edit-message');
const FIXED_NOW = '2026-09-10T10:03:00+01:00';
const labels = { forename: 'First name', surname: 'Last name', mobile: 'Mobile', email: 'Email', address: 'Address', postcode: 'Postcode' };
let personaId = 'sam';
let adapter;
let snapshot;
let route = 'home';
let week = false;
let offline = !navigator.onLine;
let expired = false;
let editing = null;
let returnFocus = null;
let clockMinutes = 0;
let fetchedAt = navigator.onLine ? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'not yet available';
let installPrompt = null;

const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const val = (obj, ...keys) => keys.map(key => obj?.[key]).find(value => value !== undefined && value !== null && value !== '') ?? 'Not supplied';
const fmtDate = value => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(value)); } catch { return String(value ?? ''); } };
const fmtTime = value => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); } catch { return ''; } };
const nowISO = () => new Date(new Date(FIXED_NOW).getTime() + clockMinutes * 60000).toISOString();
const card = (title, body, extra = '') => `<section class="card ${extra}"><h2>${title}</h2>${body}</section>`;
const action = (label, target, secondary = false) => `<button type="button" data-go="${target}" class="${secondary ? 'secondary' : ''}">${label}</button>`;

function start(id = personaId) {
  if (dialog.open) dialog.close();
  editing = null; returnFocus = null;
  personaId = id; adapter = createDemoAdapter(id); snapshot = adapter.read(); expired = false; clockMinutes = 0; week = false; route = 'home';
}


personas.forEach(persona => picker.add(new Option(persona.label, persona.id)));
picker.value = personaId;
picker.addEventListener('change', () => { start(picker.value); location.hash = 'home'; render(); });

function shell(title, body, eyebrow = 'Student Hub') {
  return `<article class="page"><header><p class="eyebrow">${eyebrow}</p><h1 tabindex="-1">${title}</h1></header>${offline ? `<div class="card warning" role="status"><strong>You are offline.</strong> Timetable cached at ${esc(fetchedAt)}. Demo updates are unavailable.</div>` : ''}${expired ? `<div class="card warning"><strong>Demo session expired.</strong> No changes can be saved. <button type="button" data-action="restart">Start new demo session</button></div>` : ''}${body}</article>`;
}

function home() {
  const state = lessonState(snapshot.lessons || [], nowISO());
  const lesson = state.current || state.next;
  const attendance = Number(snapshot.attendance94 ?? 94);
  const countdown = lesson ? Math.max(0, Math.round((new Date(lesson.start) - new Date(nowISO())) / 60000)) : 0;
  const when = lesson && fmtDate(lesson.start) !== fmtDate(nowISO()) ? `${fmtDate(lesson.start)} · ` : '';
  const next = lesson ? `<section class="next-card"><p class="eyebrow">${state.current ? 'CURRENT LESSON' : 'UP NEXT'}</p><h2>${esc(lesson.title)}</h2><div class="next-meta"><strong>${when}${fmtTime(lesson.start)}–${fmtTime(lesson.end)}</strong><span class="badge">${esc(lesson.room)}</span><span>${state.current ? 'Happening now' : `Starts in ${countdown} minutes`}</span></div><p>${esc(lesson.tutor)}</p><div class="actions">${action('Open timetable', 'timetable')}</div></section>` : card('No more lessons', '<p>There are no current or upcoming lessons in this timetable.</p>');
  const notice = (snapshot.notices || [])[1] || 'Engineering Workshop room changed to D203.';
  return shell('Your college day, sorted.', `<p class="stat">Hello, ${esc(snapshot.student.forename)}</p><p><strong>Thursday 10 September · ${fmtTime(nowISO())}</strong> · fictional demonstration clock</p><div class="actions"><button type="button" class="secondary" data-action="advance">Advance time 15 min</button><button type="button" class="secondary" data-action="reset">Reset demo</button></div>${next}<div class="grid">${card('Today', `<p><span class="stat">${state.today.length}</span> lessons scheduled</p>`)}${card('Attendance', `<p><span class="stat">${attendance}%</span></p><p>Improving · synthetic demonstration</p>`)}</div>${card('Room change', `<p class="notice">${esc(notice)}</p>`)}<div class="actions">${action('Check my details', 'details', true)}${action('Explore career paths', 'careers', true)}</div>`);
}

function lessonStatus(lesson, state) {
  if (state.current === lesson) return 'Current';
  if (state.next === lesson) return 'Next';
  if (new Date(lesson.end) <= new Date(nowISO())) return 'Completed';
  return 'Scheduled';
}
function timetable() {
  const all = snapshot.lessons || [];
  const state = lessonState(all, nowISO());
  const visible = (week ? all : state.today).filter(item => !item.cancelled && String(item.status).toLowerCase() !== 'cancelled');
  const groups = Object.groupBy ? Object.groupBy(visible, item => fmtDate(item.start)) : visible.reduce((out, item) => ((out[fmtDate(item.start)] ||= []).push(item), out), {});
  const list = Object.entries(groups).map(([day, lessons]) => `<section class="day"><h2>${esc(day)}</h2>${lessons.sort((a,b) => new Date(a.start)-new Date(b.start)).map(item => `<article class="card lesson"><strong>${fmtTime(item.start)}–${fmtTime(item.end)}</strong><div><h3>${esc(item.title)}</h3><p>${esc(item.tutor)} · Room ${esc(item.room)}</p>${item.changeNotice ? `<p class="notice">${esc(item.changeNotice)}</p>` : ''}${item.tutorChange ? `<p class="notice">${esc(item.tutorChange)}</p>` : ''}</div><span class="status">${lessonStatus(item, state)}</span></article>`).join('')}</section>`).join('') || card('Nothing scheduled', '<p>No lessons are shown for today.</p>');
  return shell('Timetable', `<div class="segments" role="tablist" aria-label="Timetable range"><button type="button" data-range="today" role="tab" aria-selected="${!week}">Today</button><button type="button" data-range="week" role="tab" aria-selected="${week}">Week</button></div>${week ? '<button type="button" class="secondary" data-range="today">Back to today</button>' : ''}${list}<p class="hint">Need help finding a room? Ask reception if needed.</p>`);
}

function course() {
  const source = snapshot.course || {};
  const title = /BSc|university/i.test(source.title || '') ? 'Level 3 Engineering' : val(source, 'title');
  const campus = /Brayford/i.test(source.campus || '') ? 'Lincoln College Monks Road' : val(source, 'campus');
  const quals = (snapshot.qualifications || []).map(q => `<li>${esc(val(q, 'subject', 'name'))}: <strong>${esc(val(q, 'grade', 'result'))}</strong></li>`).join('') || '<li>No qualifications supplied</li>';
  return shell('My Course', `${card(esc(title), `<p><strong>Tutor:</strong> ${esc(val(source, 'tutor'))}<br><strong>Campus:</strong> ${esc(campus)}<br><strong>Dates:</strong> ${esc(val(source, 'start'))} to ${esc(val(source, 'end'))}</p>`)}${card('Progress', `<p><span class="stat">${esc(val(snapshot, 'progress'))}%</span> · on track</p>`)}${card('Qualifications', `<ul>${quals}</ul><div class="actions">${action('View all qualifications', 'qualifications', true)}</div>`)}${card('Career exploration', `<p>This course-to-career association is a discussion example, not a College-approved mapping.</p><div class="actions">${action('Explore career paths', 'careers')}</div>`)}${card('Not sure this course is right for you?', `<p>Speak with your tutor or student support to explore your options. Nothing changes automatically.</p><div class="actions"><a class="button" href="../?mode=student&amp;hubPersona=${encodeURIComponent(personaId)}&amp;hubVersion=1">Explore my options</a></div>`)}`);
}

function details() {
  const rows = Object.keys(labels).map(field => `<div class="detail-row"><strong>${labels[field]}</strong><span class="value">${esc(snapshot.student[field])}</span><button type="button" class="secondary" data-edit="${field}">Edit</button></div>`).join('');
  const contacts = (snapshot.contacts || []).map(c => `<div class="contact"><div><strong>${esc(c.name)}</strong> · ${esc(c.relationship || c.role)}<br><span>${esc(c.role)} · ${esc(c.phone)} · ${esc(c.email)}</span></div></div>`).join('');
  const issues = contactIssues(snapshot.contacts);
  const warning = issues.length ? `<div class="card warning"><h2>Contact details need checking</h2><ul>${issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul><button type="button" data-action="review">Request staff review</button><p>Contacts stay unchanged while staff review this synthetic request.</p></div>` : '';
  const pending = (snapshot.requests || []).map(r => `<p><strong>${esc(r.status)}</strong> · reference ${esc(r.id)}<br>${esc(r.reason)}</p>`).join('');
  return shell('My Details', `${card('About me', rows)}${card('Primary and Secondary contacts', contacts)}${warning}${pending ? card('Review requests', pending, 'pending') : ''}<div class="actions"><button type="button" class="secondary" data-action="format-name">Demonstrate name formatting</button>${action('View audit', 'audit', true)}</div>`);
}

function more() {
  const items = [['Qualifications','qualifications'],['Exams & Results','exams'],['Attendance & Progress','progress'],['Course Match','match'],['Career Paths','careers'],['Notices','notices'],['Help','help'],['Audit','audit'],['Demo session controls','session']];
  return shell('More', `<div class="grid">${items.map(([name,target]) => `<button type="button" class="card secondary" data-go="${target}">${name}</button>`).join('')}</div>`);
}
function subview(name) {
  if (name === 'qualifications') return shell('Qualifications', card('Your results', `<ul>${(snapshot.qualifications || []).map(q => `<li>${esc(val(q,'subject','name'))}: <strong>${esc(val(q,'grade','result'))}</strong></li>`).join('') || '<li>GCSE Mathematics: 6</li><li>GCSE English: 5</li><li>GCSE Combined Science: 6-5</li>'}<div class="actions"><a class="button" href="../?mode=student&amp;hubPersona=${encodeURIComponent(personaId)}&amp;hubVersion=1">Explore my options</a></div>`));
  if (name === 'exams') return shell('Exams & Results', (snapshot.exams || []).map(x => card(esc(val(x,'qualification','name')), `<p>${esc(val(x,'date'))} · ${esc(val(x,'time'))}<br>Room ${esc(val(x,'room'))} · Seat ${esc(val(x,'seat'))}<br><strong>${esc(val(x,'status'))}</strong> · synthetic</p>`)).join('') || card('No exams', '<p>No exam records are available.</p>'));
  if (name === 'progress') return shell('Attendance & Progress', `${card('Attendance', '<p><span class="stat">94%</span> · improving</p>')}${card('Course progress', `<p><span class="stat">${esc(val(snapshot,'progress'))}%</span> · on track</p><p>Engineering principles and workshop practice module details.</p>`)}`);
  if (name === 'match') return shell('Course Match', card('Continue to Course Match', '<p>Your qualification handoff is a separate future increment. You can verify grades in the existing matcher.</p><a class="button" href="../?mode=student&amp;hubPersona=${encodeURIComponent(personaId)}&amp;hubVersion=1">Open Course Match</a>'));
  if (name === 'careers') return shell('Career Paths', `${card('Mechanical engineering technician', '<p>A discussion example, not a College-approved mapping. The National Careers Service describes possible further study towards engineering.</p><a href="https://nationalcareers.service.gov.uk/job-profiles/mechanical-engineering-technician" target="_blank" rel="noopener">Official National Careers Service profile</a>')}${card('Explore careers', '<a href="https://nationalcareers.service.gov.uk/explore-careers" target="_blank" rel="noopener">Official general careers route</a>')}${card('Skills England pathway explorer', '<p>Awaiting data connection. It is not integrated in this demonstration.</p>', 'warning')}`);
  if (name === 'notices') return shell('Notices', (snapshot.notices || ['Room change: check your timetable','Details check reminder']).map(n => card('Student notice', `<p>${esc(n)}</p>`)).join(''));
  if (name === 'audit') return shell('Audit', (snapshot.audit || []).map(a => card(esc(labels[a.field] || a.field), `<dl><dt>Before / after</dt><dd>${esc(a.before)} → ${esc(a.after)}</dd><dt>Reason / classification</dt><dd>${esc(a.kind)}</dd><dt>Source / method / decision</dt><dd>${esc(a.source)} · Student Hub demo · ${esc(a.readBack)}</dd><dt>Transaction / time / revision</dt><dd>${esc(a.transactionId)} · ${esc(a.timestamp)} · ${snapshot.revision}</dd><dt>Read-back</dt><dd>${esc(a.readBack)} · synthetic</dd></dl>`)).join('') || card('No demo changes yet', '<p>Saved demonstration actions will appear here.</p>'));
  if (name === 'session') return shell('Demo session controls', card('Synthetic session', `<p>In-memory only. Reset never contacts real services.</p><div class="actions"><button type="button" data-action="reset">Reset demo</button><button type="button" class="secondary" data-action="expire">Expire session</button></div>`));
  return shell('Help', `${card('Need help?', '<p>Ask reception, your tutor or student support. This independent demo is not a real institutional login.</p>')}${card('Add Student Hub to this device', installPrompt ? '<p data-install-status>Your browser says this demonstration can be installed.</p><button type="button" data-action="install">Add to Home Screen</button>' : '<p data-install-status>Use your browser menu and choose <strong>Add to Home Screen</strong> or <strong>Install app</strong>, if available. Availability depends on your browser and device.</p>')}`);
}

function render(focus = false) {
  if (expired) {
    app.innerHTML = `<article class="page"><header><p class="eyebrow">Student Hub</p><h1 tabindex="-1">Demo session expired</h1></header><section class="card warning"><h2>Your synthetic session has ended</h2><p>Personal details and records from the previous demonstration are no longer available. Start a new demo session to continue.</p><button type="button" data-action="restart">Start new demo session</button></section></article>`;
  } else {
    app.innerHTML = route === 'home' ? home() : route === 'timetable' ? timetable() : route === 'course' ? course() : route === 'details' ? details() : route === 'more' ? more() : subview(route);
  }
  document.querySelectorAll('[data-route]').forEach(link => link.setAttribute('aria-current', !expired && link.dataset.route === route ? 'page' : 'false'));
  if (focus) app.querySelector('h1')?.focus();
}

function navigate(target) { route = target || 'home'; if (location.hash !== `#${route}`) location.hash = route; render(true); }
window.addEventListener('hashchange', () => { route = location.hash.slice(1) || 'home'; render(true); });
window.addEventListener('offline', () => { offline = true; render(); });
window.addEventListener('online', () => { offline = false; fetchedAt = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); render(); });

app.addEventListener('click', event => {
  const go = event.target.closest('[data-go]'); if (go) return navigate(go.dataset.go);
  const range = event.target.closest('[data-range]'); if (range) { week = range.dataset.range === 'week'; return render(); }
  const edit = event.target.closest('[data-edit]'); if (edit) return openEdit(edit.dataset.edit, edit);
  const actionName = event.target.closest('[data-action]')?.dataset.action;
  if (actionName === 'advance') { clockMinutes += 15; render(); }
  if (actionName === 'reset' || actionName === 'restart') { start(); picker.value = personaId; render(); }
  if (actionName === 'expire') { adapter.expire(); adapter = undefined; snapshot = undefined; expired = true; if (dialog.open) dialog.close(); editing = null; returnFocus = null; render(); }
  if (actionName === 'review') { if (offline || expired) return; adapter.requestReview('Structural contact issue: staff must review duplicate, delete or role swap'); snapshot = adapter.read(); render(); }
  if (actionName === 'format-name') openEdit('forename', event.target);
});

function openEdit(field, opener) {
  editing = field; returnFocus = opener; const current = snapshot.student[field] ?? '';
  dialog.querySelector('h2').textContent = `Edit ${labels[field]}`; document.querySelector('#edit-current').textContent = `Current value: ${current}`; input.value = current; message.textContent = ''; updatePreview(); dialog.showModal(); input.focus();
}
function updatePreview() {
  if (!editing) return; const change = classifyChange(editing, snapshot.student[editing], input.value);
  preview.textContent = change.valid ? `Normalised preview: ${change.value} · classification: ${change.kind}` : change.error;
  preview.className = change.valid ? 'hint' : 'notice'; document.querySelector('#save-edit').disabled = !change.valid || offline || expired;
}
input.addEventListener('input', updatePreview);
form.addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return; event.preventDefault();
  if (offline) { message.textContent = 'Offline: this change was not saved.'; return; }
  if (expired) { message.textContent = 'Session expired: this change was not saved.'; return; }
  const result = adapter.update(editing, input.value, { transactionId: `${personaId}-${editing}-${snapshot.revision}-${normalise(editing,input.value)}`, expectedRevision: snapshot.revision });
  if (!result.ok) { message.textContent = result.error; return; }
  snapshot = adapter.read(); dialog.close(); render();
});
dialog.addEventListener('close', () => returnFocus?.focus());

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  if (typeof event.prompt !== 'function') return;
  installPrompt = event;
  render();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  if (route === 'help') {
    render();
    const status = app.querySelector('[data-install-status]');
    if (status) status.textContent = 'Student Hub is installed on this device.';
  }
});
app.addEventListener('click', async event => {
  if (!event.target.closest('[data-action=install]') || !installPrompt) return;
  const promptEvent = installPrompt;
  installPrompt = null;
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    render();
    const status = app.querySelector('[data-install-status]');
    if (status && choice?.outcome === 'dismissed') status.textContent = 'Installation was dismissed. You can still use your browser menu to add Student Hub later.';
  } catch {
    render();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}

start(); route = location.hash.slice(1) || 'home'; render();

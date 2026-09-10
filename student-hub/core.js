const NAME_FIELDS = new Set(['forename', 'surname']);
const CONTACT_FIELDS = new Set(['mobile', 'email', 'address', 'postcode']);
const FIELDS = new Set([...NAME_FIELDS, ...CONTACT_FIELDS]);

function text(value) {
  return value == null ? '' : String(value);
}

function titleName(value) {
  const collapsed = text(value).trim().replace(/\s+/gu, ' ');
  return collapsed.toLocaleLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, prefix, letter) => prefix + letter.toLocaleUpperCase());
}

export function normalise(field, value) {
  const input = text(value);
  if (NAME_FIELDS.has(field)) return titleName(input);
  if (field === 'mobile') return input.replace(/\s+/gu, '');
  if (field === 'email') {
    const trimmed = input.trim();
    const at = trimmed.lastIndexOf('@');
    return at < 0 ? trimmed : trimmed.slice(0, at) + '@' + trimmed.slice(at + 1).toLowerCase();
  }
  if (field === 'address') return input.trim().replace(/\s+/gu, ' ');
  if (field === 'postcode') {
    const compact = input.replace(/\s+/gu, '').toUpperCase();
    return compact.length > 3 ? compact.slice(0, -3) + ' ' + compact.slice(-3) : compact;
  }
  return input;
}

function validName(value) {
  return value.length > 0 && /^[\p{L}]+(?:[\s'\-][\p{L}]+)*$/u.test(value);
}
function validEmail(value) {
  return /^\S+@\S+\.\S+$/u.test(value);
}
function validPostcode(value) {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]? [0-9][A-Z]{2}$/u.test(value) && !/^(?:GIR 0AA|BF1 0AA)$/u.test(value) || /^(?:GIR 0AA|BF1 0AA)$/u.test(value);
}
function validation(field, value) {
  if (!FIELDS.has(field)) return 'Unknown field';
  if (NAME_FIELDS.has(field) && !validName(value)) return 'Name contains invalid characters or is empty';
  if (field === 'mobile' && !/^07[0-9]{9}$/u.test(value)) return 'Mobile must be 07 followed by nine digits';
  if (field === 'email' && !validEmail(value)) return 'Email must contain a local part and domain';
  if (field === 'address' && !value) return 'Address cannot be empty';
  if (field === 'postcode' && !validPostcode(value)) return 'Invalid UK postcode';
  return '';
}

export function classifyChange(field, before, after) {
  const value = normalise(field, after);
  const error = validation(field, value);
  if (error) return { kind: 'invalid', value, valid: false, error };
  const rawBefore = text(before);
  const beforeValue = normalise(field, before);
  if (value === rawBefore) return { kind: 'noop', value, valid: true };
  if (beforeValue === value) return { kind: 'hygiene', value, valid: true };
  const kind = NAME_FIELDS.has(field) ? 'review' : 'direct';
  return { kind, value, valid: true };
}

export function contactIssues(contacts) {
  const list = Array.isArray(contacts) ? contacts : [];
  const issues = [];
  const primaries = list.filter(c => c && c.role === 'Primary');
  const secondaries = list.filter(c => c && c.role === 'Secondary');
  if (primaries.length === 0) issues.push('Missing Primary contact');
  if (primaries.length > 1) issues.push('Multiple Primary contacts');
  if (secondaries.length === 0) issues.push('Missing Secondary contact');
  if (secondaries.length > 1) issues.push('Multiple Secondary contacts');
  if (list.length > 2) issues.push('More than two contacts');
  const ids = new Set();
  const names = new Set();
  for (const contact of list) {
    if (!contact) continue;
    if (contact.id && ids.has(String(contact.id))) issues.push('Duplicate contact IDs');
    if (contact.id) ids.add(String(contact.id));
    const key = text(contact.name).trim().replace(/\s+/gu, ' ').toLocaleLowerCase() + '|' + text(contact.phone).replace(/\s+/gu, '');
    if (text(contact.name).trim() && text(contact.phone).trim() && names.has(key)) issues.push('Duplicate contact name and phone');
    if (text(contact.name).trim() && text(contact.phone).trim()) names.add(key);
  }
  return [...new Set(issues)];
}

function londonDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid now timestamp');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function lessonState(lessons, nowISO) {
  const now = new Date(nowISO);
  if (Number.isNaN(now.getTime()) || !/[Tt]/u.test(String(nowISO))) throw new Error('Invalid now timestamp');
  const todayDate = londonDate(nowISO);
  const today = (Array.isArray(lessons) ? lessons : []).filter(lesson => londonDate(lesson.start) === todayDate).sort((a, b) => new Date(a.start) - new Date(b.start));
  const active = (Array.isArray(lessons) ? lessons : []).filter(lesson => !lesson.cancelled);
  const current = active.find(lesson => new Date(lesson.start) <= now && now < new Date(lesson.end)) || null;
  const next = active.filter(lesson => new Date(lesson.start) > now).sort((a, b) => new Date(a.start) - new Date(b.start))[0] || null;
  return { current, next, today };
}

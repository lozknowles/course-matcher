import { classifyChange } from './core.js';
import { personaData } from './data.js';

function clone(value) {
  return structuredClone(value);
}

export function createDemoAdapter(personaId, { clock } = {}) {
  const source = personaData[personaId];
  if (!source) throw new Error(`Unknown persona: ${personaId}`);
  const now = typeof clock === 'function' ? clock : () => new Date().toISOString();
  const student = clone({
    id: source.id, forename: source.forename, surname: source.surname, mobile: source.mobile,
    email: source.email, address: source.address, postcode: source.postcode
  });
  const contacts = clone(source.contacts);
  const extras = clone({ course: source.course, qualifications: source.qualifications, exams: source.exams, attendance94: source.attendance94, progress: source.progress, notices: source.notices, lessons: source.lessons });
  let revision = 0;
  let audit = [];
  let requests = [];
  let expired = false;
  const transactions = new Map();

  function ensureActive() {
    if (expired) throw new Error('SESSION_EXPIRED');
  }
  function snapshot() {
    ensureActive();
    return clone({ student, contacts, lessons: extras.lessons, course: extras.course, qualifications: extras.qualifications, exams: extras.exams, attendance94: extras.attendance94, progress: extras.progress, notices: extras.notices, revision, audit, requests });
  }
  function failure(error) { return { ok: false, revision, error }; }

  return {
    read: snapshot,
    update(field, value, options = {}) {
      ensureActive();
      const transactionId = typeof options.transactionId === 'string' ? options.transactionId.trim() : '';
      if (!transactionId) return failure('Transaction ID is required');
      if (transactions.has(transactionId)) {
        const prior = transactions.get(transactionId);
        if (prior.field === field && String(prior.input) === String(value)) return clone(prior.result);
        return failure('Transaction ID was already used for a different change');
      }
      if (!Number.isInteger(options.expectedRevision) || options.expectedRevision !== revision) return failure('Revision conflict');
      if (!(field in student)) {
        const result = failure('Unknown field');
        transactions.set(transactionId, { field, input: value, result });
        return result;
      }
      const before = student[field];
      const change = classifyChange(field, before, value);
      if (!change.valid) {
        const result = { ok: false, kind: change.kind, revision, error: change.error };
        transactions.set(transactionId, { field, input: value, result });
        return result;
      }
      if (change.kind === 'noop') {
        const result = { ok: true, kind: 'noop', revision };
        transactions.set(transactionId, { field, input: value, result });
        return result;
      }
      const timestamp = now();
      const readBack = change.kind === 'review' ? 'Pending staff review' : 'Confirmed';
      if (change.kind !== 'review') student[field] = change.value;
      revision += 1;
      if (change.kind === 'review') requests.push({ id: `${personaId}-request-${revision}`, reason: `Change ${field} from ${before} to ${change.value}`, status: 'Pending staff review', timestamp });
      audit.push({ transactionId, field, before, after: change.value, kind: change.kind, timestamp, source: 'Student self-service', readBack });
      const result = { ok: true, kind: change.kind, revision };
      transactions.set(transactionId, { field, input: value, result });
      return clone(result);
    },
    requestReview(reason) {
      ensureActive();
      if (typeof reason !== 'string' || !reason.trim()) throw new Error('Review reason is required');
      const request = { id: `${personaId}-request-${revision + 1}`, reason: reason.trim(), status: 'Pending staff review', timestamp: now() };
      requests.push(request);
      revision += 1;
      return clone(request);
    },
    expire() { expired = true; }
  };
}

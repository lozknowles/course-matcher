import { personaData } from './data.js';

export function hubHandoff(search) {
  if (typeof search !== 'string') return null;

  const params = new URLSearchParams(search);
  const personaValues = params.getAll('hubPersona');
  const versionValues = params.getAll('hubVersion');

  if (personaValues.length !== 1 || versionValues.length !== 1) return null;
  if (versionValues[0] !== '1') return null;

  const id = personaValues[0];
  if (!Object.hasOwn(personaData, id)) return null;

  return {
    id,
    grades: personaData[id].qualifications.map(({ subject, grade }) => ({ subject, grade }))
  };
}

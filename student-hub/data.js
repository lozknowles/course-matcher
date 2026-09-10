const weekdays = [
  ['Monday', '2026-09-07'],
  ['Tuesday', '2026-09-08'],
  ['Wednesday', '2026-09-09'],
  ['Thursday', '2026-09-10'],
  ['Friday', '2026-09-11']
];

function lessonsFor(personaId) {
  return weekdays.map(([day, date], index) => ({
    id: `${personaId}-${day.toLowerCase()}`,
    title: index === 3 ? 'Engineering Workshop' : `${day} Seminar`,
    tutor: index === 3 ? (personaId === 'taylor' ? 'Dr Morgan' : 'Dr Patel') : 'Dr Morgan',
    start: `${date}T${index === 3 ? '10:30' : '09:00'}:00+01:00`,
    end: `${date}T${index === 3 ? '12:00' : '10:00'}:00+01:00`,
    room: index === 3 ? 'D203' : 'B101',
    cancelled: personaId === 'alex' && day === 'Tuesday',
    changeNotice: index === 3 ? 'Synthetic timetable demonstration' : '',
    tutorChange: personaId === 'taylor' && day === 'Thursday' ? 'Tutor changed from Dr Lee' : ''
  }));
}

function base(id, forename, surname, mobile, email, address, postcode, contacts) {
  return {
    id, forename, surname, mobile, email, address, postcode, contacts,
    course: { title: 'BSc Engineering', tutor: 'Dr Morgan', campus: 'Brayford Pool', start: '2026-09-21', end: '2029-06-30' },
    qualifications: [{ name: 'Mathematics', result: 'A' }, { name: 'Physics', result: 'B' }],
    exams: [{ name: 'Engineering Principles', date: '2026-12-14', status: 'Scheduled' }],
    attendance94: 94, progress: 62,
    notices: ['Synthetic demonstration data only', 'Room change examples may appear in the timetable'],
    lessons: lessonsFor(id)
  };
}

export const personaData = {
  sam: base('sam', 'Sam', 'Taylor', '07123456789', 'sam@example.test', '1 Example Street', 'LN6 7TS', [
    { id: 'sam-primary', name: 'Sam Taylor', role: 'Primary', phone: '07123456789', email: 'sam@example.test' },
    { id: 'sam-secondary', name: 'Pat Taylor', role: 'Secondary', phone: '07987654321', email: 'pat@example.test' }
  ]),
  alex: base('alex', 'Alex', 'Morgan', '07111222333', 'alex@example.test', '2 Example Street', 'LN1 2AB', [
    { id: 'alex-primary', name: 'Alex Morgan', role: 'Primary', phone: '07111222333', email: 'alex@example.test' },
    { id: 'alex-secondary', name: 'Robin Morgan', role: 'Secondary', phone: '07888999000', email: 'robin@example.test' }
  ]),
  jordan: base('jordan', 'jOrDaN', 'o\'neal', ' 07 222 333 444 ', 'jordan@example.test', ' 3   Example   Street ', 'ln2 3cd', [
    { id: 'jordan-primary', name: 'Jordan O\'Neal', role: 'Primary', phone: '07222333444', email: 'jordan@example.test' },
    { id: 'jordan-secondary', name: 'Chris O\'Neal', role: 'Secondary', phone: '07777888999', email: 'chris@example.test' }
  ]),
  casey: base('casey', 'Casey', 'Reed', '07333444555', 'casey@example.test', '4 Example Street', 'LN4 5EF', [
    { id: 'casey-primary', name: 'Casey Reed', role: 'Primary', phone: '07333444555', email: 'casey@example.test' },
    { id: 'casey-primary', name: 'Casey  Reed', role: 'Primary', phone: '07333444555', email: 'duplicate@example.test' },
    { id: 'casey-third', name: 'Casey Reed', role: 'Secondary', phone: '07333444555', email: 'third@example.test' }
  ]),
  taylor: base('taylor', 'Taylor', 'Jones', '07444555666', 'taylor@example.test', '5 Example Street', 'LN5 6GH', [
    { id: 'taylor-primary', name: 'Taylor Jones', role: 'Primary', phone: '07444555666', email: 'taylor@example.test' },
    { id: 'taylor-secondary', name: 'Jamie Jones', role: 'Secondary', phone: '07666777888', email: 'jamie@example.test' }
  ])
};

export const personas = [
  { id: 'sam', label: 'Sam Taylor (normal)' },
  { id: 'alex', label: 'Alex Morgan (lost timetable)' },
  { id: 'jordan', label: 'Jordan O\'Neal (malformed formatting)' },
  { id: 'casey', label: 'Casey Reed (three/duplicate contacts)' },
  { id: 'taylor', label: 'Taylor Jones (course uncertainty)' }
];

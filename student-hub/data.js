const weekdays = [
  ['Monday', '2026-09-07'],
  ['Tuesday', '2026-09-08'],
  ['Wednesday', '2026-09-09'],
  ['Thursday', '2026-09-10'],
  ['Friday', '2026-09-11']
];

function lessonsFor(personaId) {
  const lessons = weekdays.map(([day, date], index) => ({
    id: `${personaId}-${day.toLowerCase()}`,
    title: index === 3 ? 'Engineering Workshop' : `${day} Seminar`,
    tutor: index === 3 ? (personaId === 'taylor' ? 'Dr Morgan' : 'Dr Patel') : 'Dr Morgan',
    start: `${date}T${index === 3 ? '10:30' : '09:00'}:00+01:00`,
    end: `${date}T${index === 3 ? '12:00' : '10:00'}:00+01:00`,
    room: index === 3 ? 'D203' : 'B101',
    cancelled: personaId === 'alex' && day === 'Tuesday',
    changeNotice: index === 3 ? 'Room changed from D201 to D203' : '',
    tutorChange: personaId === 'taylor' && day === 'Thursday' ? 'Tutor changed from Dr Lee to Dr Morgan' : ''
  }));
  lessons.push(
    { id: `${personaId}-thursday-design`, title: 'Engineering Design', tutor: 'Ms Khan', start: '2026-09-10T13:00:00+01:00', end: '2026-09-10T14:00:00+01:00', room: 'C112', cancelled: false, changeNotice: 'Room changed from C110', tutorChange: '' },
    { id: `${personaId}-thursday-maths`, title: 'Applied Mathematics', tutor: 'Dr Morgan', start: '2026-09-10T14:15:00+01:00', end: '2026-09-10T15:15:00+01:00', room: 'A204', cancelled: false, changeNotice: '', tutorChange: '' }
  );
  return lessons;
}

function base(id, forename, surname, mobile, email, address, postcode, contacts) {
  return {
    id, forename, surname, mobile, email, address, postcode, contacts,
    course: { title: 'Level 3 Engineering', tutor: 'Dr Morgan', campus: 'Lincoln College, Monks Road', start: '2026-09-01', end: '2028-06-30' },
    qualifications: [
      { subject: 'Mathematics', grade: '6', detail: 'GCSE Mathematics' },
      { subject: 'English Language', grade: '5', detail: 'GCSE English Language' },
      { subject: 'Combined Science', grade: '6-5', detail: 'GCSE Combined Science' },
      { subject: 'Computing', grade: '6', detail: 'GCSE Computing' }
    ],
    exams: [{ name: 'Engineering Principles', date: '2026-12-14', time: '09:30', room: 'E105', seat: 'B14', status: 'Scheduled' }],
    attendance94: 94, progress: 62,
    notices: ['Synthetic demonstration data only', 'Room change examples may appear in the timetable'],
    lessons: lessonsFor(id)
  };
}

export const personaData = {
  sam: base('sam', 'Sam', 'Taylor', '07700900101', 'sam@example.test', '1 Example Street', 'LN6 7TS', [
    { id: 'sam-primary', name: 'Pat Taylor', role: 'Primary', relationship: 'Parent', phone: '07700900102', email: 'pat@example.test' },
    { id: 'sam-secondary', name: 'Alex Taylor', role: 'Secondary', relationship: 'Guardian', phone: '07700900103', email: 'alex.taylor@example.test' }
  ]),
  alex: base('alex', 'Alex', 'Morgan', '07700900201', 'alex@example.test', '2 Example Street', 'LN1 2AB', [
    { id: 'alex-primary', name: 'Robin Morgan', role: 'Primary', relationship: 'Parent', phone: '07700900202', email: 'robin@example.test' },
    { id: 'alex-secondary', name: 'Casey Morgan', role: 'Secondary', relationship: 'Guardian', phone: '07700900203', email: 'casey.morgan@example.test' }
  ]),
  jordan: base('jordan', '  jOrDaN  ', '  o\'NeAl  ', '  07700 900 301  ', 'jordan@example.test', ' 3   Example   Street ', '  ln2 3ab  ', [
    { id: 'jordan-primary', name: 'Chris O\'Neal', role: 'Primary', relationship: 'Parent', phone: '07700900302', email: 'chris@example.test' },
    { id: 'jordan-secondary', name: 'Morgan O\'Neal', role: 'Secondary', relationship: 'Guardian', phone: '07700900303', email: 'morgan.oneal@example.test' }
  ]),
  casey: base('casey', 'Casey', 'Reed', '07700900401', 'casey@example.test', '4 Example Street', 'LN4 5EF', [
    { id: 'casey-primary', name: 'Riley Reed', role: 'Primary', relationship: 'Parent', phone: '07700900402', email: 'riley@example.test' },
    { id: 'casey-primary', name: 'Riley  Reed', role: 'Primary', relationship: 'Parent', phone: '07700900402', email: 'riley.duplicate@example.test' },
    { id: 'casey-third', name: 'Dana Reed', role: 'Secondary', relationship: 'Guardian', phone: '07700900403', email: 'dana@example.test' }
  ]),
  taylor: base('taylor', 'Taylor', 'Jones', '07700900501', 'taylor@example.test', '5 Example Street', 'LN5 6GH', [
    { id: 'taylor-primary', name: 'Jamie Jones', role: 'Primary', relationship: 'Parent', phone: '07700900502', email: 'jamie@example.test' },
    { id: 'taylor-secondary', name: 'Morgan Jones', role: 'Secondary', relationship: 'Guardian', phone: '07700900503', email: 'morgan.jones@example.test' }
  ])
};

export const personas = [
  { id: 'sam', label: 'Sam Taylor (normal)' },
  { id: 'alex', label: 'Alex Morgan (lost timetable)' },
  { id: 'jordan', label: "Jordan O'Neal (malformed formatting)" },
  { id: 'casey', label: 'Casey Reed (three/duplicate contacts)' },
  { id: 'taylor', label: 'Taylor Jones (course uncertainty)' }
];

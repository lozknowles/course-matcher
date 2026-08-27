/*
 * Matching-engine regression tests.
 *
 * These tests are executable examples of business behaviour, not just unit
 * coverage. When changing a course rule or matcher primitive, add/adjust a test
 * that demonstrates the intended outcome so future supporters can see why the
 * rule exists and detect accidental regressions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES } from '../courses.js';
import { parseResultsText, matchCourse, rankCourses, countQualificationsAtOrAbove, normaliseGrades, validateGrades } from '../matcher-core.js';

// Canonical synthetic profile used by the UI and documentation.
const GOLDEN=[
 {subject:'Mathematics',grade:'5'},{subject:'English Language',grade:'4'},{subject:'English Literature',grade:'3'},
 {subject:'Geography',grade:'3'},{subject:'Physics',grade:'2'},{subject:'Combined Science',grade:'5'}
];
const course=id=>COURSES.find(c=>c.id===id);

test('parses common OCR-style result lines',()=>{
 const parsed=parseResultsText('GCSE Mathematics Grade 5\nEnglish Language 4\nCombined Science 5-5\nGeography: 3');
 assert.deepEqual(parsed,[{subject:'Mathematics',grade:'5'},{subject:'English Language',grade:'4'},{subject:'Combined Science',grade:'5-5'},{subject:'Geography',grade:'3'}]);
});

test('combined science pair counts as two qualifications',()=>{
 const grades=normaliseGrades([{subject:'Combined Science',grade:'5-5'},{subject:'Mathematics',grade:'5'}]);
 assert.equal(countQualificationsAtOrAbove(grades,4),3);
});

test('parses PDF-table spacing, adjacent-line grades and conflicting duplicates for review',()=>{
 const parsed=parseResultsText([
   'GCSE Mathematics (1MA1) Grade 5     English Language (1EN0) 4',
   'Combined Science',
   '5 5',
   'Physical Education Result 6',
   'Mathematics 4'
 ].join('\n'));
 assert.deepEqual(parsed,[
   {subject:'Mathematics',grade:'5'},
   {subject:'English Language',grade:'4'},
   {subject:'Combined Science',grade:'5-5'},
   {subject:'Sport',grade:'6'},
   {subject:'Mathematics',grade:'4'}
 ]);
 assert.ok(validateGrades(parsed).issues.some(issue=>issue.type==='duplicate-subject'));
});

test('does not treat PDF page numbers as qualification grades',()=>{
 const parsed=parseResultsText('--- PDF page 1 ---\nMathematics 5\n--- PDF page 2 ---\nEnglish Language 4');
 assert.deepEqual(parsed,[
   {subject:'Mathematics',grade:'5'},
   {subject:'English Language',grade:'4'}
 ]);
});

test('duplicate and unrecognised CSV subjects cannot fabricate a GCSE total',()=>{
 const course={rule:{minTotal:{count:5,grade:4}}};
 const duplicateMaths=Array.from({length:5},()=>({subject:'Mathematics',grade:'5'}));
 const unknownColumns=['Notes','Attendance','Predicted grade','Comment','Other'].map(subject=>({subject,grade:'9'}));
 for(const grades of [duplicateMaths,unknownColumns]){
   const result=matchCourse(grades,course);
   assert.notEqual(result.status,'green');
   assert.ok(result.inputIssues.length);
 }
 assert.equal(validateGrades(unknownColumns).grades.length,0);
});

test('golden student qualifies for Level 2 Computing & Electronics Technician',()=>{
 const r=matchCourse(GOLDEN,course('computing-electronics-l2'));
 assert.equal(r.status,'green');
});

test('golden student is an amber near-match for Level 3 Business',()=>{
 const r=matchCourse(GOLDEN,course('business-l3'));
 assert.equal(r.status,'amber');
 assert.ok(r.warnings.some(w=>/Combined Science/.test(w)));
});

test('strong computing profile passes Level 3 Computing',()=>{
 const grades=[['Mathematics','6'],['English Language','5'],['Computing','7'],['Combined Science','6-6']].map(([subject,grade])=>({subject,grade}));
 assert.equal(matchCourse(grades,course('computing-l3')).status,'green');
});

test('interest filter prioritises only selected subject family',()=>{
 const ranked=rankCourses(GOLDEN,COURSES,['Computing'],'');
 assert.ok(ranked.length>=2);
 assert.ok(ranked.every(r=>r.course.subject==='Computing'));
});

test('education and childcare foundation requires both English and Maths at grade 3+',()=>{
 const missingMaths=[['English Language','4'],['Geography','3'],['History','3'],['Combined Science','3-3']].map(([subject,grade])=>({subject,grade}));
 const r=matchCourse(missingMaths,course('education-childcare-foundation-l2'));
 assert.notEqual(r.status,'green');
 assert.ok(r.checks.some(c=>/Mathematics grade 3/.test(c.label)&&!c.pass));
});

test('engineering interest includes cross-listed electronic computing pathway',()=>{
 const ranked=rankCourses(GOLDEN,COURSES,['Engineering'],'');
 assert.ok(ranked.some(r=>r.course.id==='electronic-computing-l3'));
 assert.ok(ranked.some(r=>r.course.id==='asi-space-engineering-l2'));
});

/*
 * Course Match domain logic
 * -------------------------
 * This module contains the qualification parsing and course-matching rules.
 * It deliberately has no DOM/browser dependencies so the behaviour can be
 * regression-tested directly with Node.
 *
 * Important support boundary:
 * - This module evaluates only the explicit machine-readable rules supplied
 *   by courses.js.
 * - It does not make an admissions decision.
 * - `status` and `score` are presentation/ranking aids for the prototype, not
 *   probabilities of acceptance.
 *
 * See ARCHITECTURE.md for the rule schema and data-flow diagrams.
 */

/**
 * Common variations seen in manually entered or OCR-derived subject names.
 *
 * Keep this map deliberately conservative. A false alias is worse than a
 * missed alias because it can attach a grade to the wrong qualification.
 */
export const SUBJECT_ALIASES = {
  'maths': 'Mathematics', 'math': 'Mathematics', 'mathematics': 'Mathematics',
  'english': 'English Language', 'english language': 'English Language', 'eng lang': 'English Language',
  'english literature': 'English Literature', 'eng lit': 'English Literature',
  'combined science': 'Combined Science', 'science': 'Combined Science',
  'physics': 'Physics', 'chemistry': 'Chemistry', 'biology': 'Biology',
  'geography': 'Geography', 'history': 'History', 'art': 'Art & Design', 'art and design': 'Art & Design',
  'ict': 'Computing', 'computer science': 'Computing', 'computing': 'Computing',
  'business': 'Business', 'sport': 'Sport', 'pe': 'Sport'
};

// Subjects the prototype can safely treat as GCSE evidence. Unknown CSV
// columns are retained for review but must never make up a GCSE total.
export const RECOGNISED_GCSE_SUBJECTS = new Set([
  'Mathematics', 'English Language', 'English Literature', 'Combined Science',
  'Biology', 'Chemistry', 'Physics', 'Geography', 'History', 'Art & Design',
  'Computing', 'Business', 'Sport', 'French', 'German', 'Spanish',
  'Religious Studies', 'Sociology', 'Psychology', 'Economics', 'Drama', 'Music'
]);

/**
 * Return a canonical subject label where a known alias exists.
 * Unknown labels are retained (title-cased) rather than discarded so that
 * manual/adviser data is not silently lost.
 */
export function normaliseSubject(subject = '') {
  const key = String(subject).trim().toLowerCase().replace(/\s+/g, ' ');
  return SUBJECT_ALIASES[key] || String(subject).trim().replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Parse a user/OCR grade into a small typed representation.
 *
 * Supported forms:
 *   "5"   -> { type: 'single', value: 5 }
 *   "5-5" -> { type: 'pair', values: [5, 5] }
 *   "5/5" -> same as 5-5
 *   "A"   -> approximate numeric legacy conversion, marked converted=true
 *
 * Unrecognised text is retained as `{ type: 'text' }` so callers can treat it
 * as non-numeric evidence rather than inventing a value.
 */
export function parseGrade(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return null;

  const pair = raw.match(/^([1-9])\s*[-/]\s*([1-9])$/);
  if (pair) return { type: 'pair', values: [Number(pair[1]), Number(pair[2])], raw };

  const numeric = raw.match(/^[1-9]$/);
  if (numeric) return { type: 'single', value: Number(raw), raw };

  // Legacy letter-grade mapping is intentionally approximate. If this becomes
  // material to a College-owned production service, validate the policy with
  // the appropriate curriculum/admissions owner rather than extending it ad hoc.
  const legacy = { A: 7, B: 6, C: 4, D: 3, E: 2, F: 1, G: 1 };
  if (legacy[raw]) return { type: 'single', value: legacy[raw], raw, converted: true };

  return { type: 'text', raw };
}

/**
 * Return the numeric value used for threshold comparisons.
 *
 * For a pair (notably Combined Science), the lower grade is returned for an
 * individual subject threshold. Qualification *counting* is handled separately
 * by countQualificationsAtOrAbove(), where each half of the pair can count.
 */
export function numericGrade(value) {
  const grade = typeof value === 'object' && value?.type ? value : parseGrade(value);
  if (!grade) return null;
  if (grade.type === 'single') return grade.value;
  if (grade.type === 'pair') return Math.min(...grade.values);
  return null;
}

/**
 * Convert raw `{ subject, grade }` rows into the canonical internal shape.
 */
export function normaliseGrades(rows = []) {
  return rows
    .filter(row => row && String(row.subject || '').trim() && String(row.grade ?? '').trim())
    .map(row => ({
      subject: normaliseSubject(row.subject),
      grade: parseGrade(row.grade),
      rawGrade: String(row.grade).trim()
    }));
}

/**
 * Validate input before it is used as qualification evidence.
 *
 * A duplicate subject is ambiguous rather than two GCSEs. This is especially
 * important for adviser CSV files, whose headers are user-controlled.
 */
export function validateGrades(rows = []) {
  const normalised = Array.isArray(rows) && rows[0]?.grade?.type
    ? rows
    : normaliseGrades(rows);
  const issues = [];
  const seen = new Set();
  const grades = [];

  for (const row of normalised) {
    if (!RECOGNISED_GCSE_SUBJECTS.has(row.subject)) {
      issues.push({ type: 'unknown-subject', subject: row.subject });
      continue;
    }
    if (numericGrade(row.grade) === null) {
      issues.push({ type: 'invalid-grade', subject: row.subject });
      continue;
    }
    if (seen.has(row.subject)) {
      issues.push({ type: 'duplicate-subject', subject: row.subject });
      continue;
    }
    seen.add(row.subject);
    grades.push(row);
  }

  return { grades, issues };
}

/**
 * Count qualifications meeting a numeric threshold.
 *
 * Combined Science is the only deliberate double-award special case here:
 * `5-5` can count as two qualifications at grade 5+, whereas a single `5`
 * counts as one because the application must not infer an unevidenced award.
 */
export function countQualificationsAtOrAbove(grades, threshold) {
  let count = 0;

  for (const row of grades) {
    if (row.subject === 'Combined Science' && row.grade?.type === 'pair') {
      count += row.grade.values.filter(v => v >= threshold).length;
    } else if (numericGrade(row.grade) >= threshold) {
      count += 1;
    }
  }

  return count;
}

/** Return a canonical subject's numeric grade, or null when not evidenced. */
export function getGrade(grades, subject) {
  const wanted = normaliseSubject(subject);
  const row = grades.find(g => normaliseSubject(g.subject) === wanted);
  return row ? numericGrade(row.grade) : null;
}

/** True when at least one subject in a published alternative group meets the threshold. */
export function hasSubjectAtOrAbove(grades, subjects, threshold) {
  return subjects.some(subject => (getGrade(grades, subject) ?? -1) >= threshold);
}

/**
 * Evaluate the supported hard-rule primitives from courses.js.
 *
 * Returned `checks` are intentionally human-readable because they are rendered
 * directly as evidence in both student and adviser views.
 *
 * `gaps` is a coarse measure used only to distinguish a close/amber mismatch
 * from a larger/red mismatch. It is not an admissions score.
 */
function evaluateRule(grades, rule) {
  const checks = [];
  let hardFailures = 0;
  let gaps = 0;

  if (rule.minTotal) {
    const got = countQualificationsAtOrAbove(grades, rule.minTotal.grade);
    const need = rule.minTotal.count;
    const pass = got >= need;

    checks.push({
      pass,
      label: `${need} GCSEs at grade ${rule.minTotal.grade}+`,
      detail: `${got} evidenced`
    });

    if (!pass) {
      hardFailures += 1;
      gaps += Math.max(0, need - got);
    }
  }

  for (const req of rule.subjects || []) {
    const got = getGrade(grades, req.subject);
    const pass = got !== null && got >= req.grade;

    checks.push({
      pass,
      label: `${req.subject} grade ${req.grade}+`,
      detail: got === null ? 'not evidenced' : `grade ${got}`
    });

    if (!pass) {
      hardFailures += 1;
      gaps += got === null ? 1 : Math.max(0, req.grade - got);
    }
  }

  for (const req of rule.anySubjects || []) {
    const pass = hasSubjectAtOrAbove(grades, req.subjects, req.grade);

    checks.push({
      pass,
      label: `${req.subjects.join(' or ')} grade ${req.grade}+`,
      detail: pass ? 'evidenced' : 'not evidenced'
    });

    if (!pass) {
      hardFailures += 1;
      gaps += 1;
    }
  }

  if (rule.noFormalGrades) {
    checks.push({
      pass: true,
      label: 'No formal GCSE entry requirement encoded',
      detail: 'other checks may still apply'
    });
  }

  return { checks, hardFailures, gaps };
}

/**
 * Evaluate one student/profile against one course.
 *
 * Status meanings:
 * - green: all encoded hard grade checks pass;
 * - amber: close mismatch or the course is intentionally `manualOnly`;
 * - red: larger mismatch against the encoded hard checks.
 *
 * Warnings are not failures. They represent conditions that the current rule
 * model must leave to a person (interview, reference, DBS, portfolio, etc.).
 */
export function matchCourse(gradesInput, course) {
  const { grades, issues: inputIssues } = validateGrades(gradesInput);

  const evaluation = evaluateRule(grades, course.rule || {});
  const warnings = [...(course.warnings || [])];
  if (inputIssues.length) {
    warnings.push('Some results need correction before this can be treated as a grade match. Check for duplicate subjects, unsupported subjects or invalid grades.');
  }

  // A single Combined Science grade may under-count a double award. Warn rather
  // than guessing: the verification step is where a user can correct it to 5-5.
  const combined = grades.find(g => g.subject === 'Combined Science');
  if (
    combined?.grade?.type === 'single' &&
    (course.rule?.minTotal || course.rule?.anySubjects?.some(r => r.subjects.includes('Combined Science')))
  ) {
    warnings.push(
      'Combined Science is entered as one grade. If this is a double-award result, enter it as a pair such as 5-5 so GCSE counts are not understated.'
    );
  }

  let status = 'green';
  if (evaluation.hardFailures > 0) status = evaluation.gaps <= 2 ? 'amber' : 'red';
  if (course.rule?.manualOnly) status = 'amber';
  if (inputIssues.length) status = 'amber';

  // Internal ordering only. Do not expose this as an acceptance likelihood.
  const score = status === 'green'
    ? 100
    : status === 'amber'
      ? 65 - evaluation.gaps * 4
      : Math.max(10, 35 - evaluation.gaps * 4);

  return { course, ...evaluation, warnings, inputIssues, status, score };
}

/**
 * Rank courses after evaluating their encoded grade rules.
 *
 * Selecting interests narrows the result set to matching subject families.
 * Free-text career/topic input adds a small relevance boost where the text
 * appears in the course title, subject or controlled keyword list.
 */
export function rankCourses(gradesInput, courses, interests = [], careerText = '') {
  const interestSet = new Set(interests.map(x => x.toLowerCase()));
  const career = careerText.trim().toLowerCase();

  return courses
    .map(course => {
      const result = matchCourse(gradesInput, course);
      const interestHit = interestSet.has(course.subject.toLowerCase()) ||
        (course.interests || []).some(x => interestSet.has(x.toLowerCase()));
      const careerHit = Boolean(career) &&
        [course.title, course.subject, ...(course.keywords || [])]
          .join(' ')
          .toLowerCase()
          .includes(career);
      const relevance = (interestSet.size && interestHit ? 25 : 0) + (careerHit ? 10 : 0);

      return { ...result, interestHit, relevance, totalScore: result.score + relevance };
    })
    .filter(result => !interestSet.size || result.interestHit)
    .sort((a, b) =>
      b.totalScore - a.totalScore ||
      a.course.level - b.course.level ||
      a.course.title.localeCompare(b.course.title)
    );
}

/**
 * Extract simple subject/grade pairs from OCR or copied results text.
 *
 * This is intentionally a conservative parser, not a general document AI
 * system. It only emits a subject when a recognised subject label and grade
 * occur together. The UI *always* sends parsed output through human verification
 * before matching.
 */
export function parseResultsText(text = '') {
  const cleaned = String(text).replace(/\r/g, '\n');
  const lines = cleaned.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const subjects = [
    'English Language', 'English Literature', 'Mathematics', 'Maths',
    'Combined Science', 'Biology', 'Chemistry', 'Physics', 'Geography',
    'History', 'Business', 'Computer Science', 'Computing', 'Art and Design',
    'Art', 'Sport', 'Physical Education', 'PE', 'French', 'German', 'Spanish',
    'Religious Studies', 'Sociology', 'Psychology', 'Economics', 'Drama', 'Music'
  ];

  const results = [];
  const seen = new Set();

  for (const line of lines) {
    for (const subject of subjects) {
      const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(
        `\\b${escaped}\\b\\s*(?:[:\\-–]\\s*)?(?:(?:grade|result|gcse)\\s*)?([1-9](?:\\s*[-/]\\s*[1-9])?|[A-G])\\b`,
        'i'
      );
      const match = line.match(re);

      if (match) {
        const normal = normaliseSubject(subject);
        const key = normal.toLowerCase();

        // Keep the first recognised occurrence of each subject. Human review can
        // correct duplicates/ambiguity before the record reaches the matcher.
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ subject: normal, grade: match[1].replace(/\s+/g, '') });
        }
      }
    }
  }

  return results;
}

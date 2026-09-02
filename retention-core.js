/*
 * Pure decision-support rules for the synthetic 42-day demonstration.
 *
 * These helpers deliberately do not decide a learner outcome. They describe
 * the College process, keep transfer options dormant until course fit is the
 * relevant intervention, and make every consequential step human-reviewed.
 */

export const INTERVENTIONS = Object.freeze({
  course_mismatch: {
    label: 'Course / subject mismatch',
    action: 'Evaluate alternative programmes with the learner.',
    owner: 'Curriculum Lead',
    transferCapable: true
  },
  academic_difficulty: {
    label: 'Academic difficulty',
    action: 'Consider academic support and, only where appropriate, adjacent or lower-level provision.',
    owner: 'Curriculum team',
    transferCapable: true
  },
  support_need: {
    label: 'Unmet support need',
    action: 'Route to the appropriate learner-support service.',
    owner: 'Learner Support',
    transferCapable: false
  },
  belonging: {
    label: 'Belonging / settling in',
    action: 'Provide pastoral and settling-in support, then review.',
    owner: 'Pastoral support',
    transferCapable: false
  },
  transport: {
    label: 'Transport / access',
    action: 'Investigate transport, timetable and accessibility options first.',
    owner: 'Student Services',
    transferCapable: false
  },
  careers: {
    label: 'Unclear career direction',
    action: 'Arrange Careers Guidance before considering a destination.',
    owner: 'Careers Guidance',
    transferCapable: false
  },
  known_alternative: {
    label: 'Known alternative course',
    action: 'Check entry requirements, fit, learner preference and capacity with the receiving area.',
    owner: 'Curriculum Lead',
    transferCapable: true
  },
  conduct: {
    label: 'Behaviour / conduct',
    action: "Follow the College's Learner Conduct Procedure; do not treat this as automatic course matching.",
    owner: 'Curriculum / conduct lead',
    transferCapable: false
  },
  external_environment: {
    label: 'College environment not suitable',
    action: 'Support an informed external-provider pathway where that is genuinely right for the learner.',
    owner: 'Careers / Student Services',
    transferCapable: false
  }
});

export const OUTCOMES = Object.freeze({
  remain: 'Learner remains successfully on the current programme',
  internal_transfer: 'Learner transfers internally to a more appropriate programme',
  careers_review: 'Careers Guidance and continued review',
  support_intervention: 'Academic, pastoral or learner-support intervention',
  external_transition: 'Informed transition to another provider',
  potential_withdrawal: 'Potential withdrawal - Student Recruitment Group review required'
});

export function interventionFor(code) {
  const intervention = INTERVENTIONS[code];
  if (!intervention) throw new Error(`Unknown intervention code: ${code}`);
  return intervention;
}

export function processPath(record) {
  const intervention = interventionFor(record.concernCode);
  const path = ['Concern', 'Supportive conversation', 'Diagnose why', intervention.label];
  if (record.transferAppropriate && intervention.transferCapable) {
    path.push('Match + fit + eligibility', 'Learner discussion', 'Curriculum Lead', 'Human decision');
  } else {
    path.push('Possible intervention', 'Monitor / review', 'Human decision');
  }
  return path;
}

export function alternativesState(record) {
  const intervention = interventionFor(record.concernCode);
  const visible = Boolean(record.transferAppropriate && intervention.transferCapable);
  return {
    visible,
    label: visible ? 'Potential alternatives for discussion' : 'Dormant contingency options',
    reason: visible
      ? 'Transfer is an appropriate intervention to explore with the learner.'
      : 'Do not show course alternatives until diagnosis indicates that transfer is appropriate.'
  };
}

export function warmStartAlternatives(alternatives = []) {
  return alternatives.slice(0, 3).map((alternative, index) => ({
    ...alternative,
    order: index + 1,
    state: 'Contingency option',
    recommendation: false
  }));
}

export function buildTransferHandoff(record, alternative) {
  if (record.outcome !== 'internal_transfer' || !record.transferAgreed) {
    throw new Error('Transfer handoff is available only after a human-reviewed internal transfer agreement.');
  }
  const handoff = {
    studentName: record.name,
    studentId: record.id,
    courseCode: alternative?.courseCode,
    group: alternative?.group,
    startDate: alternative?.startDate
  };
  const missing = Object.entries(handoff).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Transfer handoff is incomplete: ${missing.join(', ')}`);
  return { state: 'Transfer handoff ready', ...handoff };
}

export function withdrawalReviewPath(record) {
  if (record.outcome !== 'potential_withdrawal') return [];
  return ['Potential withdrawal', 'Student Recruitment Group review', 'Human decision / outcome'];
}

export function capacityOptimisationAllowed({ learnerSuitability, entryCompliance, learnerChoice, humanApproval }) {
  return Boolean(learnerSuitability && entryCompliance && learnerChoice && humanApproval);
}

export function outcomeLabel(code) {
  const label = OUTCOMES[code];
  if (!label) throw new Error(`Unknown outcome code: ${code}`);
  return label;
}

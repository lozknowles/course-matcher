export const RULESET = Object.freeze({
  id: 'GLCCA-2026-27-DEMO',
  label: 'Greater Lincolnshire 2026/27 demonstration rules',
  annualEarningsThreshold: 26800,
  ucAetSingleMonthly: 991,
  ucAetJointMonthly: 1597,
  residencyYears: 3,
  note: 'Demonstration configuration only. Lincoln College/CIS must confirm the operational GLCCA values and approved learning aim before production use.'
});

export const OUTCOME = Object.freeze({
  SIXTEEN_NINETEEN: '16-19 funding route',
  FULL: 'Likely fully funded',
  COFUNDED: 'Likely co-funded',
  LOAN: 'Loan / self-funding route',
  MANUAL: 'Manual funding review',
  NOT_ELIGIBLE: 'Not automatically eligible'
});

const full = (reason, evidence = [], flags = []) => ({
  code: 'FULL', label: OUTCOME.FULL, tone: 'green', reason, evidence, flags
});
const manual = (reason, evidence = [], flags = []) => ({
  code: 'MANUAL', label: OUTCOME.MANUAL, tone: 'amber', reason, evidence, flags
});
const cof = (reason, evidence = [], flags = []) => ({
  code: 'COFUNDED', label: OUTCOME.COFUNDED, tone: 'blue', reason, evidence, flags
});
const loan = (reason, evidence = [], flags = []) => ({
  code: 'LOAN', label: OUTCOME.LOAN, tone: 'purple', reason, evidence, flags
});
const notEligible = (reason, evidence = [], flags = []) => ({
  code: 'NOT_ELIGIBLE', label: OUTCOME.NOT_ELIGIBLE, tone: 'red', reason, evidence, flags
});

function incomeEvidence(profile) {
  if (profile.employment === 'employed' || profile.employment === 'self-employed') {
    return ['Gross earnings evidence (for example payslip, contract or approved equivalent)'];
  }
  if (profile.benefit === 'uc') {
    return ['Current Universal Credit statement showing earned income'];
  }
  return [];
}

function residencyEvidence(profile) {
  if (profile.residency === 'exception') return ['Residency/immigration exception evidence'];
  return ['Identity and home-address/residency evidence'];
}

function adultIncomeStatus(profile, rules) {
  const annual = Number(profile.annualGross || 0);
  const monthly = Number(profile.ucMonthlyEarnings || 0);
  const joint = profile.ucClaim === 'joint';
  const aet = joint ? rules.ucAetJointMonthly : rules.ucAetSingleMonthly;

  if (profile.benefit === 'jsa' || profile.benefit === 'esa') {
    return { status: 'unemployed', reason: `${profile.benefit.toUpperCase()} selected`, evidence: ['Benefit status evidence'] };
  }

  if (profile.benefit === 'uc') {
    if (monthly < aet) {
      return { status: 'unemployed', reason: `UC earned income £${monthly.toLocaleString('en-GB')} is below the configured £${aet.toLocaleString('en-GB')} monthly AET`, evidence: ['Universal Credit statement'] };
    }
    if (annual > 0 && annual <= rules.annualEarningsThreshold) {
      return { status: 'low-earnings', reason: `Annual gross earnings are at/below the configured £${rules.annualEarningsThreshold.toLocaleString('en-GB')} threshold`, evidence: incomeEvidence(profile) };
    }
    return { status: 'above-threshold', reason: `UC earned income is not below the configured AET and annual earnings do not meet the low-earnings route`, evidence: ['Universal Credit statement', ...incomeEvidence(profile)] };
  }

  if (profile.benefit === 'pip' || profile.benefit === 'other') {
    if (annual > 0 && annual <= rules.annualEarningsThreshold) {
      return { status: 'low-earnings', reason: `Other benefit selected, but the low-earnings test is independently met`, evidence: ['Benefit evidence', ...incomeEvidence(profile)] };
    }
    return { status: 'discretion', reason: `${profile.benefit === 'pip' ? 'PIP' : 'Other state benefit'} does not by itself establish automatic tuition funding`, evidence: ['Benefit evidence', ...incomeEvidence(profile)] };
  }

  if (profile.employment === 'retired') {
    return { status: 'discretion', reason: 'Retired/pensioner status is not treated as an automatic fee exemption in this demonstration', evidence: ['Funding officer review of applicable income/entitlement evidence'] };
  }

  if (profile.employment === 'unemployed') {
    return { status: 'discretion', reason: 'Unemployed with no qualifying benefit selected: provider discretion/employment relevance must be evidenced', evidence: ['Evidence of employment intent / local labour-market relevance'] };
  }

  if (annual <= rules.annualEarningsThreshold) {
    return { status: 'low-earnings', reason: `Annual gross earnings £${annual.toLocaleString('en-GB')} are at/below the configured £${rules.annualEarningsThreshold.toLocaleString('en-GB')} threshold`, evidence: incomeEvidence(profile) };
  }

  return { status: 'above-threshold', reason: `Annual gross earnings £${annual.toLocaleString('en-GB')} exceed the configured £${rules.annualEarningsThreshold.toLocaleString('en-GB')} threshold`, evidence: incomeEvidence(profile) };
}

function isAdult(profile) {
  return Number(profile.age) >= 19;
}

export function evaluateFunding(profile, rules = RULESET) {
  const age = Number(profile.age);
  const baseEvidence = [...residencyEvidence(profile), 'Approved learning aim / course funding status'];
  const path = [];

  path.push({ stage: 'age', value: age < 19 ? '16-18' : (age <= 23 ? '19-23' : '24+') });

  if (age < 16) {
    return { ...manual('Outside this FE demonstration age range.', baseEvidence), path, rules };
  }

  if (age <= 18 || (age <= 24 && profile.ehcp)) {
    path.push({ stage: 'route', value: '16-19' });
    if (profile.residency === 'no') {
      return { ...manual('16-19 route selected, but residency/immigration eligibility needs review.', baseEvidence), path, rules };
    }
    return {
      code: 'SIXTEEN_NINETEEN', label: OUTCOME.SIXTEEN_NINETEEN, tone: 'navy',
      reason: age <= 18 ? 'Learner is within the normal 16-19 funding age route.' : '19-24 learner with an EHC plan remains on the 16-19 funding route.',
      evidence: baseEvidence,
      flags: ['Benefits may affect learner support/bursary, but do not by themselves determine the core study-programme funding route.'],
      path, rules
    };
  }

  if (!isAdult(profile)) {
    return { ...manual('Age route could not be classified.', baseEvidence), path, rules };
  }

  path.push({ stage: 'route', value: 'adult' });

  if (profile.residency === 'no') {
    path.push({ stage: 'residency', value: 'not-confirmed' });
    return { ...notEligible('The 3-year residency condition is not confirmed and no exception has been selected.', baseEvidence, ['Check the full GLCCA residency exception list before declining funding.']), path, rules };
  }
  if (profile.residency === 'exception') {
    path.push({ stage: 'residency', value: 'exception' });
  } else {
    path.push({ stage: 'residency', value: '3-years' });
  }

  const entitlement = profile.entitlement || 'other';
  path.push({ stage: 'course', value: entitlement });

  if (entitlement === 'english-maths') {
    return { ...full('Eligible English/maths legal entitlement selected.', [...baseEvidence, 'Evidence learner has not already achieved the relevant GCSE grade 4/C or equivalent']), path, rules };
  }

  if (entitlement === 'essential-digital') {
    return { ...full('Eligible essential digital skills entitlement selected.', [...baseEvidence, 'Initial assessment / prior attainment evidence']), path, rules };
  }

  if (age <= 23 && entitlement === 'first-full-l2') {
    return { ...full('19-23 learner on an approved first full Level 2 entitlement.', [...baseEvidence, 'Prior attainment check confirming first full Level 2 entitlement']), path, rules };
  }

  if (age <= 23 && entitlement === 'first-full-l3') {
    return { ...full('19-23 learner on an approved first full Level 3 entitlement.', [...baseEvidence, 'Prior attainment check confirming first full Level 3 entitlement']), path, rules };
  }

  const income = adultIncomeStatus(profile, rules);
  path.push({ stage: 'income', value: income.status });
  const evidence = [...baseEvidence, ...income.evidence];

  if (income.status === 'discretion') {
    return { ...manual(`${income.reason}. The course may still be fundable, but staff judgement and the current funding rules are required.`, evidence), path, rules };
  }

  if (entitlement === 'fcfj-l3') {
    if (income.status === 'low-earnings' || income.status === 'unemployed') {
      return { ...full(`Eligible Level 3 Free Courses for Jobs route; ${income.reason}.`, evidence), path, rules };
    }
    return { ...loan(`Level 3 Free Courses for Jobs low-earnings/unemployed test is not met; ${income.reason}. Check Advanced Learner Loan/designated qualification or self-funding.`, evidence), path, rules };
  }

  const level = profile.courseLevel || 'l2';
  if (level === 'entry' || level === 'l1' || level === 'l2') {
    if (income.status === 'low-earnings' || income.status === 'unemployed') {
      return { ...full(`Adult Level 2-or-below route and the low-earnings/unemployed test is met; ${income.reason}.`, evidence), path, rules };
    }
    return { ...cof(`Adult Level 2-or-below route but the low-earnings/unemployed test is not met; ${income.reason}.`, evidence), path, rules };
  }

  if (level === 'l3') {
    return { ...loan(`No automatic Level 3 entitlement has been selected and ${income.reason}. Check designated Advanced Learner Loan or self-funding.`, evidence), path, rules };
  }

  return { ...manual('Level 4+ provision needs the applicable higher-level funding/loan route checked, including any Lifelong Learning Entitlement rules.', evidence), path, rules };
}

export const DEMO_SCENARIOS = Object.freeze([
  {
    id: 'school-leaver', label: '17-year-old school leaver',
    profile: { age: 17, ehcp: false, residency: 'yes', courseLevel: 'l3', entitlement: 'other', employment: 'unemployed', benefit: 'none', annualGross: 0, ucClaim: 'single', ucMonthlyEarnings: 0 }
  },
  {
    id: 'first-l3', label: '22, first full Level 3',
    profile: { age: 22, ehcp: false, residency: 'yes', courseLevel: 'l3', entitlement: 'first-full-l3', employment: 'employed', benefit: 'none', annualGross: 31000, ucClaim: 'single', ucMonthlyEarnings: 0 }
  },
  {
    id: 'low-earnings-l2', label: '35, working, £24k, Level 2',
    profile: { age: 35, ehcp: false, residency: 'yes', courseLevel: 'l2', entitlement: 'other', employment: 'employed', benefit: 'none', annualGross: 24000, ucClaim: 'single', ucMonthlyEarnings: 0 }
  },
  {
    id: 'uc-l2', label: '41, UC, low earnings, Level 2',
    profile: { age: 41, ehcp: false, residency: 'yes', courseLevel: 'l2', entitlement: 'other', employment: 'employed', benefit: 'uc', annualGross: 12000, ucClaim: 'single', ucMonthlyEarnings: 780 }
  },
  {
    id: 'pip-review', label: 'PIP only - review',
    profile: { age: 38, ehcp: false, residency: 'yes', courseLevel: 'l2', entitlement: 'other', employment: 'unemployed', benefit: 'pip', annualGross: 0, ucClaim: 'single', ucMonthlyEarnings: 0 }
  },
  {
    id: 'retired', label: 'Retired learner - review',
    profile: { age: 68, ehcp: false, residency: 'yes', courseLevel: 'l2', entitlement: 'other', employment: 'retired', benefit: 'none', annualGross: 0, ucClaim: 'single', ucMonthlyEarnings: 0 }
  }
]);
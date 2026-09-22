// Lincoln College course-capacity snapshot transcribed from the user-supplied ProResource/ProSolution photograph.
// This is point-in-time operational evidence, not an admissions rule or live capacity feed.
export const AVAILABILITY_SNAPSHOT = {
  sourceDate: '2026-09-21',
  sourceLabel: 'Lincoln College capacity photograph · page 1',
  ageBands: ['16-18','19+']
};

export const AVAILABILITY_ROWS = [
  ['SPL0367AA1','Lincoln Campus','Planned','ESOL Study Programme Level 1 & Level 2',12,5,-7,6,3,-3],
  ['SPL0369AA1','Lincoln Campus','Planned','ESOL Study Programme Entry 3',14,5,-9,4,4,0],
  ['SPL0370AA1','Lincoln Campus','Planned','ESOL Study Programme Entry 1 and Entry 2',13,10,-3,5,4,-1],
  ['SPL0108AA1','Lincoln Campus','Planned','Skills for Independence - Lincoln',24,21,-3,0,3,3],
  ['SPL0111AA1','Lincoln Campus','Planned','Skills for Sport',15,15,0,0,0,0],
  ['SPL0121AA1','Lincoln Campus','Planned','Skills for Catering - Lincoln',22,19,-3,0,3,3],
  ['SPL0172AA1','Lincoln Campus','Planned','Supported Internships and Employment Programmes',12,5,-7,0,2,2],
  ['SPL0202AA1','Lincoln Campus','Planned','Skills for Construction - Lincoln',24,25,1,0,0,0],
  ['SPL0204AA1','Lincoln Campus','Planned','Skills for Health and Social Care - Lincoln',28,27,-1,0,3,3],
  ['SPL0205AA1','Lincoln Campus','Planned','Skills for Creative and Performing Arts',31,27,-4,1,5,4],
  ['SPL0236AA1','Lincoln Campus','Planned','Skills for Customer Service and Enterprise',15,15,0,1,1,0],
  ['SPN0202AA1','Newark Campus','New Course','Skills for Construction - Newark',0,0,0,0,0,0],
  ['SPN0236AA1','Newark Campus','Planned','Skills for Customer Service and Enterprise',16,14,-2,0,1,1],
  ['SPL0173AA1','Lincoln Campus','Planned','National Extended Diploma in Sports Coaching, Development and Physical Education Level 3',32,19,-13,0,0,0],
  ['SPL0173AA2','Lincoln Campus','Planned','National Extended Diploma in Sports Coaching, Development and Physical Education Level 3',12,11,-1,0,0,0],
  ['SPL0175AA1','Lincoln Campus','Planned','National Diploma in Sport Science + A Levels Level 3',0,2,2,0,0,0],
  ['SPL0175AA2','Lincoln Campus','Planned','National Diploma in Sport Science + A Levels Level 3',0,2,2,0,0,0],
  ['SPL0176AA1','Lincoln Campus','Planned','National Extended Diploma in Sport Science and Physiotherapy Level 3',30,19,-11,2,2,0],
  ['SPL0176AA2','Lincoln Campus','Planned','National Extended Diploma in Sport Science and Physiotherapy Level 3',25,21,-4,0,1,1],
  ['SPL0308AA1','Lincoln Campus','Planned','Sports Coaching and PE Level 3',19,15,-4,0,0,0],
  ['SPL0308AA2','Lincoln Campus','Planned','Sports Coaching and PE Level 3',13,12,-1,0,0,0],
  ['SPL0309AA2','Lincoln Campus','Removed','Sport Fitness and Personal Training Level 3',0,0,0,0,0,0],
  ['SPL0310AA1','Lincoln Campus','Planned','Introduction to the Sport and Active Leisure Industry Level 2',44,33,-11,0,2,2],
  ['SPL0366AA1','Lincoln Campus','Planned','Introductory Certificate in Sport Level 1',20,11,-9,0,2,2],
  ['SPL0373AA1','Lincoln Campus','Planned','BTEC Technical Diploma for Personal Trainer Level 3',18,11,-7,4,1,-3],
  ['SPL0373AA2','Lincoln Campus','Planned','BTEC Technical Diploma for Personal Trainer Level 3',18,12,-6,0,2,2],
  ['SPO0285AA1','Off Premises','Planned','National Extended Diploma in Sports Coaching and Development Level 3',6,6,0,0,0,0],
  ['SPO0285AA2','Off Premises','Planned','National Extended Diploma in Sports Coaching and Development Level 3',6,5,-1,0,0,0],
  ['SPO0192AA1','Caistor Equestrian Centre','Planned','Advanced Technical Extended Diploma Equine Management Level 3',9,4,-5,3,0,-3],
  ['SPO0192AA2','Caistor Equestrian Centre','Planned','Advanced Technical Extended Diploma Equine Management Level 3',3,1,-2,0,4,4],
  ['SPO0194AA1','Caistor Equestrian Centre','Planned','Technical Certificate in Equine Care Level 2',7,8,1,0,0,0],
  ['SPO0179AA1','Off Premises','Planned','Introductory Diploma in Land-Based Studies Level 1',24,17,-7,0,2,2]
].map(([courseCode,site,status,title,plan16,enrolled16,variance16,plan19,enrolled19,variance19]) => ({
  courseCode, site, status, title,
  '16-18': { plan: plan16, enrolled: enrolled16, variance: variance16 },
  '19+': { plan: plan19, enrolled: enrolled19, variance: variance19 }
}));

// Only map a photographed capacity row to an encoded matcher course where the correspondence is sufficiently clear.
export const COURSE_CAPACITY_MAP = {
  'skills-health-care': { courseCode:'SPL0204AA1', confidence:'high' },
  'sport-active-l2': { courseCode:'SPL0310AA1', confidence:'high' }
};

export function capacityStatus(row, ageBand='16-18') {
  if (!row) return { code:'unknown', label:'Availability not on supplied page', places:null };
  if (row.status === 'Removed') return { code:'removed', label:'Removed in snapshot', places:0 };
  const band = row[ageBand];
  if (!band) return { code:'unknown', label:'Availability unknown', places:null };
  if (band.plan > 0 && band.variance < 0) {
    const places = Math.abs(band.variance);
    return { code:'available', label:`${places} place${places===1?'':'s'} in snapshot`, places };
  }
  if (band.plan > 0 && band.variance >= 0) return { code:'full', label:'Full / at plan in snapshot', places:0 };
  if (band.plan === 0 && band.enrolled > 0) return { code:'check', label:'No plan shown; active enrolments', places:null };
  return { code:'check', label:'Capacity needs staff check', places:null };
}

export function courseCapacity(courseId, ageBand='16-18') {
  const mapping = COURSE_CAPACITY_MAP[courseId];
  if (!mapping) return { ...capacityStatus(null, ageBand), mapped:false };
  const row = AVAILABILITY_ROWS.find(item => item.courseCode === mapping.courseCode);
  return { ...capacityStatus(row, ageBand), mapped:true, row, confidence:mapping.confidence };
}

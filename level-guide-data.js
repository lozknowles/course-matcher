// Student-facing qualification-level guide reconstructed from the supplied Lincoln College artwork.
// Explanatory only: these examples never alter course eligibility or admissions decisions.
export const LEVEL_GUIDE = [
  { level:0, label:'Entry Level', sector:'Further Education (FE)', examples:['Entry Level Award, Certificate, Diploma','Functional Skills'] },
  { level:1, label:'Level 1', sector:'Further Education (FE)', examples:['Functional Skills','NVQ (Level 1)'] },
  { level:2, label:'Level 2', sector:'Further Education (FE)', examples:['Award, Certificate, Diploma','GCSEs','Intermediate Apprenticeship','NVQ (Level 2)','National Certificate/Diploma','T Level – Transition offer'] },
  { level:3, label:'Level 3', sector:'Further Education (FE)', examples:['Advanced Apprenticeship','A Levels','T Levels'], note:'The supplied photograph crops the remaining Level 3 examples, so this prototype shows only the clearly visible items.' },
  { level:4, label:'Level 4', sector:'Higher Education (HE)', examples:['Certificate of Higher Education','Higher Apprenticeship','Higher National Certificate','NVQ (Level 4)','HTQs'] },
  { level:5, label:'Level 5', sector:'Higher Education (HE)', examples:['Diploma of Higher Education','Foundation Degree','Higher National Diploma','HTQs'] },
  { level:6, label:'Level 6', sector:'Higher Education (HE)', examples:["Bachelor’s Degree with Honours",'Degree Apprenticeship','Professional Graduate Diploma in Education'] }
];

export function levelGuideFor(level) {
  return LEVEL_GUIDE.find(item => item.level === Number(level)) || LEVEL_GUIDE[0];
}

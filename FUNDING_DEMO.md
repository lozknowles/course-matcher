# Funding Decision Tree demonstration

This is an **unofficial Lincoln College demonstration** for discussing how funding eligibility could be made easier to understand during enrolment. It is decision support only: it does not determine funding, charge a learner, write to ProSolution, or replace the current GLCCA/DfE funding rules or Lincoln College funding-team judgement.

## Files

- `funding-decision.html` - graphical interactive demonstrator
- `funding-decision.css` - Lincoln College demonstration styling
- `funding-decision.js` - browser interaction and path highlighting
- `funding-core.js` - pure, testable rule evaluation
- `tests/funding.test.mjs` - regression tests for representative scenarios

## Design

The screen asks only relevant facts and shows the selected path through five gates:

1. age / 16-19 vs adult route
2. residency and funding authority
3. course level, entitlement and prior attainment
4. employment, benefits and earnings
5. explained route: 16-19, fully funded, co-funded, loan/self-funding or manual review

The output always includes a reason and evidence checklist. Ambiguous cases are deliberately routed to manual review rather than silently guessed.

## Demonstration rule configuration

`funding-core.js` keeps thresholds in a versioned `RULESET` object. Current demonstration values are:

- annual earnings threshold: **£26,800**
- Universal Credit AET: **£991/month** sole adult, **£1,597/month** joint claim
- residency gate: **3 years**, subject to documented exceptions

These are **configuration values, not permanent constants**. The published GLCCA 2026/27 funding-rules document still states £25,750 while noting it would be aligned after the DfE 2026/27 figure was released; current Greater Lincolnshire provider-facing enrolment evidence uses £26,800. Lincoln/CIS should confirm the operational figure before any production pilot. The UC AET values reflect current DWP values from 1 April 2026; GLCCA/provider implementation must still be confirmed.

PIP or pensioner/retired status is not treated as an automatic tuition-fee exemption. Where a legal entitlement or low-earnings route does not resolve the case, the demo returns **Manual funding review**.

## Primary sources

- Greater Lincolnshire Adult Skills Programme: https://greaterlincolnshire-cca.gov.uk/home/adult-skills-programme
- GLCCA Adult Skills Fund funding rules 2026/27: https://greaterlincolnshire-cca.gov.uk/downloads/file/90/adult-skills-fund-funding-rules
- DfE 16-19 funding rules 2026/27: https://www.gov.uk/government/publications/advice-funding-rules-for-16-to-19-provision/advice-funding-rules-for-16-to-19-provision-2026-to-2027
- DfE Advanced Learner Loans rules 2026/27: https://www.gov.uk/government/publications/advanced-learner-loans-funding-and-performance-management-rules/advanced-learner-loans-funding-and-performance-management-rules-2026-to-2027
- DWP Universal Credit earnings/AET: https://www.gov.uk/guidance/universal-credit-and-earnings

## Production boundary

Before production use, replace the demonstration ruleset with a College-owned, dated rule catalogue covering funding authority/postcode, learning-aim eligibility, legal entitlements, prior attainment, earnings thresholds, benefit tests, residency exceptions, evidence requirements, ILR coding and provider discretion. Every outcome should retain the rule version and evidence used.

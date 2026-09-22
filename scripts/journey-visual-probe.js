// Read-only browser assertion. Evaluate this expression in the rendered journey.
() => {
  const yellow = 'rgb(255, 219, 69)', red = 'rgb(186, 40, 51)';
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const panels = [...document.querySelectorAll('.stage-header,.card,.art-levels-copy,.art-level-card,.art-careers,.context-card,.help-card,.celebration')];
  check(panels.length > 2, 'Journey panels missing');
  const menu = [...document.querySelectorAll('#journey-nav button')];
  check(menu.length === 6, 'Journey navigation groups missing');
  for (const item of menu) {
    const style = getComputedStyle(item), outline = getComputedStyle(item, '::before');
    check(style.backgroundColor === yellow && style.borderRadius === '0px', 'Menu must use square-edged yellow boxes');
    check(outline.borderTopColor === red && ['2px', '3px'].includes(outline.borderTopWidth), 'Menu red outline missing');
  }
  for (const panel of panels) {
    const style = getComputedStyle(panel);
    check(style.backgroundColor === yellow, `Yellow fill missing: ${panel.className}`);
    const frame = panel.matches('.stage-header') ? getComputedStyle(panel, '::before') : style;
    check(frame.borderTopColor === red && ["2px", "3px", "4px"].includes(frame.borderTopWidth), `Red frame missing: ${panel.className}`);
  }
  const hero = document.querySelector('.stage-header');
  const frame = getComputedStyle(hero, '::before');
  check(frame.left === '7px' && frame.top === '-6px' && frame.transform !== 'none', 'Hero frame must be offset from yellow panel');
  check(document.documentElement.scrollWidth <= innerWidth, 'Horizontal page overflow');
  for (const element of document.querySelectorAll('.stage-header h1,.art-careers h2,.art-level-card')) {
    check(element.scrollWidth <= element.clientWidth + 1, `Content clipped: ${element.className}`);
  }
  const levels = [...document.querySelectorAll('.art-level-card > strong')].map(el => el.textContent);
  if (levels.length) check(levels.join('|') === 'Entry Level|Level 1|Level 2|Level 3|Level 4|Level 5|Level 6', 'Level progression changed');
  return { viewport: innerWidth, panelsChecked: panels.length, levels, passed: true };
};

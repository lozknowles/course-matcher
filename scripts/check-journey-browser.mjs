// Browser regression checks for an already-open demo tab. No browser is launched
// and no user record is read: the visible presenter controls create synthetic data.
// Supply the Codex browser tab and viewport capability (documented in the guide).
export async function checkJourneyBrowser(tab, viewport, record = async () => {}) {
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const read = () => tab.playwright.evaluate(() => ({
    title: document.querySelector('#stage-title').textContent,
    position: document.querySelector('#position').textContent,
    phase: document.querySelector('#phase').textContent,
    width: window.innerWidth,
    contentWidth: document.documentElement.scrollWidth,
    controls: [...document.querySelectorAll('#stage button')].length,
  }));
  const controls = tab.playwright.locator('#demo-controls');
  if (await controls.getAttribute('open') === null) await controls.locator('summary').click();
  await tab.playwright.locator('#technical-toggle').uncheck();
  await tab.playwright.locator('#scenario').selectOption('standard');
  for (const size of [
    {name:'iphone',width:390,height:844},
    {name:'tablet',width:820,height:1180},
  ]) {
    await viewport.set({width:size.width,height:size.height});
    for (let step=1;step<=10;step++) {
      await tab.playwright.locator('#stage-picker').selectOption(String(step));
      await tab.playwright.locator('#load-stage').click();
      const state = await read();
      assert(state.contentWidth<=state.width, `${size.name} stage ${step} overflows horizontally`);
      assert(state.position.includes(`Step ${step} of 10`), `Wrong stage: ${state.position}`);
      assert(state.controls>0, `Missing stage controls at ${step}`);
      const result={name:`${size.name}-${String(step).padStart(2,'0')}`, ...state};
      results.push(result);
      await record(result);
    }
    await tab.playwright.locator('#all-steps').click();
    assert(await tab.playwright.locator('#steps-grid button').count()===10,'Missing journey steps');
    await tab.playwright.locator('#steps-grid [data-step="3"]').click();
    assert((await read()).title==='Apply online','Revisit failed');
    assert((await read()).position.includes('Step 10'),'Revisit changed progress');
    await tab.reload();
    assert((await read()).phase==='Student','Resume lost student status');
    assert((await read()).title==='Apply online','Resume lost viewed stage');
    await tab.playwright.locator('#demo-controls > summary').click();
    await tab.playwright.locator('#reset').click();
    assert((await read()).phase==='Prospect','Reset failed');
    await tab.playwright.locator('#all-steps').click();
    await tab.playwright.locator('#steps-grid [data-step="9"]').click();
    assert(!await tab.playwright.locator('[data-action="check-in"]').isEnabled(),'Future action not guarded');
  }
  return results;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { languages, keys, translations, resolveLanguage, directionFor } from '../student-self-service-languages.js';

test('portal matches the language codes and order verified on the prior-attainment service', () => {
  assert.deepEqual(languages.map(([code]) => code), ['en','ur','bn','ar','pl','ro','uk','ru','fa','fr','es','pt']);
  const html = readFileSync(new URL('../student-self-service.html', import.meta.url), 'utf8');
  const options = [...html.matchAll(/<option value="([a-z]+)"/g)].map(match => match[1]);
  assert.deepEqual(options, languages.map(([code]) => code));
  const usedKeys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(match => match[1]);
  for (const [code] of languages) {
    assert.deepEqual(Object.keys(translations[code]), keys);
    for (const key of [...keys,...usedKeys]) assert.ok(translations[code][key]?.trim(), `${code}/${key}`);
  }
});
test('invalid saved preferences fall back safely and RTL is limited to the three RTL languages', () => {
  for (const input of [null, undefined, '', '__proto__', 'constructor', 'invalid']) assert.equal(resolveLanguage(input),'en');
  for (const [code] of languages) {
    assert.equal(resolveLanguage(code),code);
    assert.equal(directionFor(code), ['ur','ar','fa'].includes(code) ? 'rtl' : 'ltr');
  }
});
test('demo navigation exposes the existing prior-attainment service without changing its destination', () => {
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html, /<a class="tab" href="prior-attainment\/">Prior Attainment<\/a>/);
});

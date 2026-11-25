const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, symlinkSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const out = mkdtempSync(join(tmpdir(), 'gulyai-questionnaire-'));
process.on('exit', () => rmSync(out, { recursive: true, force: true }));
symlinkSync(resolve('node_modules'), join(out, 'node_modules'), 'dir');
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'src/profile/QuestionnaireSummary.tsx', '--outDir', out, '--module', 'commonjs', '--target', 'es2022', '--jsx', 'react', '--esModuleInterop', '--skipLibCheck']);
const { QuestionnaireSummary } = require(join(out, 'QuestionnaireSummary.js'));
const render = props => renderToStaticMarkup(React.createElement(QuestionnaireSummary, props));
test('detailed activities replace broad categories; older profiles retain their activities', () => {
  const fallbackActivities = [{ label: 'Старое занятие', emoji: '🎲' }];
  assert.match(render({ fallbackActivities }), /Старое занятие/);
  assert.match(render({ value: { version: 1, activities: [] }, fallbackActivities }), /Старое занятие/);
  const html = render({ value: { version: 1, activities: ['Кино', 'Кофе и разговоры'], favouriteActivity: 'Кофе и разговоры' }, fallbackActivities });
  assert.doesNotMatch(html, /Старое занятие/);
  assert.ok(html.indexOf('Кофе и разговоры') < html.indexOf('Кино'));
});
test('only explicitly public personal answers render, including inside collapsed details', () => {
  const html = render({ value: { version: 1, personal: {
    humour: { values: ['Публичный ответ'], visible: true },
    alcohol: { values: ['Скрытый ответ'], visible: false },
    differentViews: { values: ['Без согласия'] },
    unknown: { values: ['Неизвестное поле'], visible: true }
  } } });
  assert.match(html, /Публичный ответ/);
  assert.doesNotMatch(html, /Скрытый ответ|Без согласия|Неизвестное поле/);
});

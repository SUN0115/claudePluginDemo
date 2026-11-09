// bash-guard 的測試。執行：node --test "plugins/dev-buddy/hooks/*.test.mjs"
//
// 分兩部分：
//   1. 直接測 check()：規則判斷對不對
//   2. 真的把 JSON 餵給腳本：確認 exit code 和 stderr，跟 Claude Code 呼叫時一模一樣

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check } from './bash-guard.mjs';

const SCRIPT = fileURLToPath(new URL('./bash-guard.mjs', import.meta.url));

function runHook(input) {
	return spawnSync(process.execPath, [SCRIPT], { input, encoding: 'utf8' });
}

const blocked = [
	'git push --force',
	'git push origin main -f',
	'git reset --hard HEAD~1',
	'rm -rf dist',
	'rm -r -f dist',
	'rm -fr ./build',
	'rm --recursive --force tmp',
	'npm run build && rm -Rf out',
];

const allowed = [
	'git push',
	'git push --force-with-lease',
	'git reset --soft HEAD~1',
	'rm file.txt',
	'rm -r emptydir',
	'ls -rf',
	'npm test',
];

for (const cmd of blocked) {
	test(`擋下：${cmd}`, () => assert.ok(check(cmd), `應該被擋：${cmd}`));
}

for (const cmd of allowed) {
	test(`放行：${cmd}`, () => assert.equal(check(cmd), null, `不該被擋：${cmd}`));
}

test('危險指令：exit 2，且 stderr 有原因', () => {
	const r = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push --force' } }));
	assert.equal(r.status, 2);
	assert.match(r.stderr, /force-push/);
});

test('一般指令：exit 0', () => {
	const r = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test' } }));
	assert.equal(r.status, 0);
});

test('壞掉的 JSON：fail-open，exit 0', () => {
	const r = runHook('not json');
	assert.equal(r.status, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const source = readFileSync('index.html', 'utf8');
const patchPath = resolve('tests/fixtures/a03-6-selective-index-only.patch');
const patch = readFileSync(patchPath, 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const report = {
  case: 'WRONG A-03-8: dev-rooted +9/-3 selective preflight',
  source: 'dev 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',
  candidate: 'A03-6 source commit 1ea5ef6f1c0295f9f33459f423f59c0094763f60',
  outcome: 'BLOCKED_UNSATISFIED_PREREQUISITES',
  actualAppEdits: 0,
  originalSha256: sha256(source),
  safeToRestore: false,
  syntheticOnly: true,
};

test('1. immutable A03-6 patch scope stays exactly +9/-3', () => {
  const lines = patch.split('\n');
  report.patchAdditions = lines.filter(x => x.startsWith('+') && !x.startsWith('+++')).length;
  report.patchDeletions = lines.filter(x => x.startsWith('-') && !x.startsWith('---')).length;
  assert.equal(report.patchAdditions, 9);
  assert.equal(report.patchDeletions, 3);
});

test('2. current dev does not contain the ACK/busy safety scaffolding expected by the 3 hunks', () => {
  report.prerequisites = {
    unknownCreateId: source.includes('wrongA03UnknownCreateId'),
    saveBusy: source.includes('wrongA03SaveBusy'),
    readonlyListVerification: source.includes("if(route==='records')renderRecords();"),
    unguardedOriginalPhotoAwait: source.includes('blob=image?await photoBlob():null'),
  };
  assert.equal(report.prerequisites.unknownCreateId, false);
  assert.equal(report.prerequisites.saveBusy, false);
  assert.equal(report.prerequisites.readonlyListVerification, false);
  assert.equal(report.prerequisites.unguardedOriginalPhotoAwait, true);
});

test('3. actual git apply --check rejects the unmodified selective patch; disposable rollback stays byte-exact', () => {
  const temp = mkdtempSync(join(tmpdir(), 'wrong-a03-8-'));
  try {
    writeFileSync(join(temp, 'index.html'), source);
    const init = spawnSync('git', ['init', '-q'], { cwd: temp, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const preflight = spawnSync('git', ['apply', '--check', '--verbose', patchPath], { cwd: temp, encoding: 'utf8' });
    report.gitApplyCheckExitCode = preflight.status;
    report.gitApplyCheckStderr = (preflight.stderr || '').slice(0, 3000);
    assert.notEqual(preflight.status, 0, 'Expected patch conflict; do not silently apply without predecessors');
    assert.match(report.gitApplyCheckStderr, /patch does not apply|failed|error/i);
    assert.equal(sha256(readFileSync(join(temp, 'index.html'))), report.originalSha256);

    // A failed application with --reject may partially alter the disposable copy.
    // Restore the original dev bytes explicitly, not a product repository or live DB.
    const attempted = spawnSync('git', ['apply', '--reject', patchPath], { cwd: temp, encoding: 'utf8' });
    report.disposableApplyExitCode = attempted.status;
    report.rejectedHunks = existsSync(join(temp, 'index.html.rej'));
    assert.notEqual(attempted.status, 0);
    writeFileSync(join(temp, 'index.html'), source);
    report.disposableRollbackSha256 = sha256(readFileSync(join(temp, 'index.html')));
    report.disposableRollbackByteExact = report.disposableRollbackSha256 === report.originalSha256;
    assert.equal(report.disposableRollbackByteExact, true);
    report.actualAppEdits = 0;

    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/a03-8-selective-preflight.json', JSON.stringify(report, null, 2) + '\n');
    console.log('A03-8 SELECTIVE PREFLIGHT: BLOCKED as expected; exact rollback verified; no app modifications');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

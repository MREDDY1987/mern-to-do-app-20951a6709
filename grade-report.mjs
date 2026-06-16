import crypto from 'crypto';
import fs from 'fs';
const E = process.env;

if (!E.MPOWER_STUDENT_ID || !E.MPOWER_WEBHOOK_URL) {
  console.log('Grader not configured (missing student id / webhook url) — skipping.');
  process.exit(0);
}

let testsPassed = 0, testsTotal = 0;
try {
  const r = JSON.parse(fs.readFileSync('jest-results.json', 'utf8'));
  testsPassed = r.numPassedTests ?? 0;
  testsTotal = r.numTotalTests ?? 0;
} catch {}

const buildStatus = E.BUILD_OUTCOME === 'success' ? 'SUCCESS' : 'FAILURE';
const score = testsTotal > 0 ? Math.round((testsPassed / testsTotal) * 100) : 0;
const status = (buildStatus === 'SUCCESS' && testsTotal > 0 && testsPassed === testsTotal)
  ? 'passed' : (buildStatus === 'FAILURE' ? 'error' : 'failed');

const ts = Math.floor(Date.now() / 1000).toString();
const msg = [ts, E.MPOWER_TENANT_ID, E.MPOWER_ASSIGNMENT_ID, E.MPOWER_STUDENT_ID, E.COMMIT_SHA, String(score)].join('.');
const sig = crypto.createHmac('sha256', E.MPOWER_WEBHOOK_SECRET).update(msg).digest('hex');

const res = await fetch(`${E.MPOWER_WEBHOOK_URL}/project-labs/webhook/results`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-mpower-timestamp': ts, 'x-mpower-signature': sig },
  body: JSON.stringify({
    tenantId: E.MPOWER_TENANT_ID, assignmentId: E.MPOWER_ASSIGNMENT_ID, studentId: E.MPOWER_STUDENT_ID,
    repoUrl: E.REPO_URL, repoFullName: E.REPO_FULL, commitSha: E.COMMIT_SHA,
    commitMessage: (E.COMMIT_MSG || '').slice(0, 200), branch: E.BRANCH,
    status, score, testsPassed, testsTotal, buildStatus,
    logsUrl: `${E.REPO_URL}/actions/runs/${E.RUN_ID}`, githubRunId: E.RUN_ID,
  }),
});
console.log('LMS:', res.status, await res.text());
if (!res.ok) process.exit(1);

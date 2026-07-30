const baseUrl = (process.env.E2E_BASE_URL || 'https://no-way-down.onrender.com').replace(/\/$/, '');
const expected = process.env.E2E_EXPECTED_SHA?.trim();
const timeout = Number(process.env.E2E_DEPLOY_TIMEOUT_MS || 20 * 60 * 1000);
const initialInterval = Number(process.env.E2E_DEPLOY_POLL_INTERVAL_MS || 15_000);
const maxInterval = 30_000;
if (!/^[0-9a-f]{40}$/i.test(expected || '')) throw new Error('E2E_EXPECTED_SHA must be a full SHA');
if (!(timeout > 0) || !(initialInterval > 0)) throw new Error('deploy wait timing values must be positive');
const started = Date.now();
let attempt = 0;
let observed = '(unavailable)';
let deploy = '(unavailable)';
while (Date.now() - started < timeout) {
  attempt += 1;
  let status = 'network-error';
  try {
    const response = await fetch(`${baseUrl}/api/build-info/`, { signal: AbortSignal.timeout(Math.min(30_000, initialInterval)) });
    status = String(response.status);
    if (response.ok) {
      const info = await response.json();
      observed = info.sourceSha || '(missing)';
      deploy = info.deployCommit || info.renderCommit || '(missing)';
      console.log(`[production-sha] attempt=${attempt} http=${status} sourceSha=${observed} deployCommit=${deploy} elapsedMs=${Date.now() - started}`);
      if (info.status === 'ok' && info.sourceSha === expected && info.frontendSha === expected) {
        console.log(`[production-sha] expected source ${expected} is live`);
        process.exit(0);
      }
    } else console.log(`[production-sha] attempt=${attempt} http=${status} sourceSha=${observed} deployCommit=${deploy} elapsedMs=${Date.now() - started}`);
  } catch {
    console.log(`[production-sha] attempt=${attempt} http=${status} sourceSha=${observed} deployCommit=${deploy} elapsedMs=${Date.now() - started}`);
  }
  const delay = Math.min(maxInterval, initialInterval * Math.max(1, attempt));
  await new Promise((resolve) => setTimeout(resolve, Math.min(delay, Math.max(0, timeout - (Date.now() - started)))));
}
throw new Error(`Expected GitHub source ${expected}, production still reports ${observed}, deploy commit ${deploy}`);

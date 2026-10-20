import {installFailureIssueUrl} from '../src/terminal/InstallFailedOverlay';
import {classifyInstallFailure, cleanInstallLog, installFailureCopy} from '../src/terminal/installFailure';

describe('installFailure', () => {
  test('trusts Android about being offline, then reads the log', () => {
    expect(classifyInstallFailure('', 'codex_failed', false)).toBe('offline');
    expect(classifyInstallFailure('npm error code ENOTFOUND', 'codex_failed', true)).toBe('network');
    expect(classifyInstallFailure('curl: (6) Could not resolve host: claude.ai', 'claude_failed', undefined)).toBe('network');
    expect(classifyInstallFailure('E: Failed to fetch http://deb.debian.org/debian/pool/x.deb', 'apk_failed', undefined)).toBe('network');
    expect(classifyInstallFailure('npm error code ENOSPC', 'codex_failed', true)).toBe('storage');
    expect(classifyInstallFailure('npm warn EBADENGINE Unsupported engine', 'codex_failed', true)).toBe('node_version');
    expect(classifyInstallFailure('EACCES: permission denied', 'codex_failed', true)).toBe('permissions');
    expect(classifyInstallFailure('ERROR: unsatisfiable constraints', 'apk_failed', true)).toBe('packages');
    expect(classifyInstallFailure('', 'codex_failed', true)).toBe('unknown');
  });

  test('reads apk resolver failures as network, not just packages', () => {
    expect(classifyInstallFailure('ERROR: jq-1.8.2-r0: DNS: transient error (try again later)', 'apk_failed', true)).toBe('network');
    expect(classifyInstallFailure('ERROR: git-2.54.0-r0: I/O error', 'apk_failed', true)).toBe('packages');
  });

  test('cleans escapes, markers, redraws, and repeated progress from the log', () => {
    const raw = '\u001b[32mHORUS_INSTALL_STAGE=codex\u001b[0m\r\nDownloading Codex… 10%\nDownloading Codex… 20%\nhalf\rwhole\nnpm error boom\n';
    expect(cleanInstallLog(raw)).toBe('Downloading Codex… 20%\nwhole\nnpm error boom');
    expect(cleanInstallLog('HORUS_INSTALL_STAGE=start\n')).toBeUndefined();
  });

  test('points to mirrors only for downloads that can use one', () => {
    expect(installFailureCopy({kind: 'network'}, 'codex').advice).toContain('Settings › Downloads');
    expect(installFailureCopy({kind: 'network'}, 'claude').advice).not.toContain('mirror');
    expect(installFailureCopy({kind: 'offline'}, 'opencode')).toEqual(expect.objectContaining({title: 'Couldn’t install OpenCode', reason: 'Your phone is offline.'}));
  });
});

describe('installFailureIssueUrl', () => {
  test('keeps the head (stage, readiness, build) as well as the tail of a long log', () => {
    const log = `stage: ready\n\nreadiness(shell): zsh=y git=y rg=y\n\n${'x'.repeat(6000)}\nERROR: last line`;
    const url = installFailureIssueUrl(
      'shell',
      {kind: 'unknown', stage: 'ready', log},
      {appVersion: '1.1.0-abc1234', androidVersion: '13'},
    );
    const body = decodeURIComponent(url.slice(url.indexOf('body=') + 5));
    expect(body).toContain('Horus: 1.1.0-abc1234');
    expect(body).toContain('stage: ready');
    expect(body).toContain('readiness(shell): zsh=y git=y rg=y');
    expect(body).toContain('ERROR: last line');
    expect(body.length).toBeLessThan(3200);
  });
});

import { describe, expect, it } from 'vitest';
import { expandTemplate, DownloadError } from '../download-manager';

describe('expandTemplate', () => {
  it('replaces {version} and {file} placeholders', () => {
    const url = expandTemplate(
      'https://example.com/{version}/{file}',
      '1.8.1',
      'snowluma-core-1.8.1-win32-x64.zip',
    );
    expect(url).toBe('https://example.com/1.8.1/snowluma-core-1.8.1-win32-x64.zip');
  });

  it('encodes URL components to avoid path traversal', () => {
    const url = expandTemplate('https://example.com/{version}/{file}', '../bad', 'a/b');
    expect(url).toBe('https://example.com/..%2Fbad/a%2Fb');
  });

  it('replaces multiple occurrences', () => {
    const url = expandTemplate('https://x/{version}/{version}/{file}', 'v1', 'a');
    expect(url).toBe('https://x/v1/v1/a');
  });
});

describe('DownloadError', () => {
  it('captures all per-mirror failures', () => {
    const err = new DownloadError('all failed', [
      { mirrorId: 'github', attempt: 1, error: 'timeout' },
      { mirrorId: 'github', attempt: 2, error: 'ECONNRESET' },
      { mirrorId: 'mirror-x', attempt: 1, error: '404' },
    ]);
    expect(err.failures).toHaveLength(3);
    expect(err.failures[0]?.mirrorId).toBe('github');
  });
});

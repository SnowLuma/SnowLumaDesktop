import { describe, expect, it } from 'vitest';
import { compareSemver, evaluateQqVersion, type QqCompatManifest } from '../qq-compat';

const manifest: QqCompatManifest = {
  version: 1,
  policy: { allowUnknown: true, warnUnknown: false },
  knownGoodVersions: [{ version: '9.9.20.0' }, { version: '9.9.21.0' }],
  knownBadVersions: [{ version: '9.9.18.0', reason: 'breaks msgPush parser' }],
  minVersion: '9.9.0.0',
};

describe('compareSemver', () => {
  it('handles equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });
  it('compares numeric parts', () => {
    expect(compareSemver('1.2.3', '1.2.4')).toBeLessThan(0);
    expect(compareSemver('1.3.0', '1.2.99')).toBeGreaterThan(0);
  });
  it('handles missing segments as 0', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0);
    expect(compareSemver('1.2', '1.2.1')).toBeLessThan(0);
  });
});

describe('evaluateQqVersion', () => {
  it('recognises a known-good version', () => {
    const v = evaluateQqVersion(manifest, '9.9.20.0');
    expect(v.kind).toBe('good');
  });
  it('flags a known-bad version', () => {
    const v = evaluateQqVersion(manifest, '9.9.18.0');
    expect(v.kind).toBe('bad');
    if (v.kind === 'bad') expect(v.reason).toMatch(/msgPush/);
  });
  it('flags too-old versions', () => {
    const v = evaluateQqVersion(manifest, '9.8.99.0');
    expect(v.kind).toBe('too-old');
  });
  it('returns unknown for unlisted versions when policy.allowUnknown=true', () => {
    const v = evaluateQqVersion(manifest, '9.9.99.0');
    expect(v.kind).toBe('unknown');
  });
  it('disallows unknown when policy.allowUnknown=false', () => {
    const strict: QqCompatManifest = { ...manifest, policy: { allowUnknown: false } };
    const v = evaluateQqVersion(strict, '9.9.99.0');
    expect(v.kind).toBe('bad');
  });
});

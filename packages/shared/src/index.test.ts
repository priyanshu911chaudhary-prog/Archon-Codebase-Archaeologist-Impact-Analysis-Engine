import { describe, expect, it } from 'vitest';
import { ARCHON_APP_NAME, ARCHON_VERSION } from './index.js';

describe('shared package metadata', () => {
  it('exports non-empty app name and semver version', () => {
    expect(ARCHON_APP_NAME).toBe('Archon');
    expect(ARCHON_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

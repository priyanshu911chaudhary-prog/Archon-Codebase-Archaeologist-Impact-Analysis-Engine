import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EnvValidationError, findRepoRoot, loadEnv, parseEnv } from './env.js';

const BASE_VALID_ENV: Record<string, string | undefined> = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://archon:secret@127.0.0.1:5432/archon',
  REDIS_URL: 'redis://127.0.0.1:6379',
  GITHUB_TOKEN: 'ghp_test_token_123',
};

describe('parseEnv', () => {
  it('applies documented defaults for optional and numeric/boolean variables', () => {
    const env = parseEnv(BASE_VALID_ENV);

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      LOG_LEVEL: 'info',
      DATABASE_URL: 'postgresql://archon:secret@127.0.0.1:5432/archon',
      REDIS_URL: 'redis://127.0.0.1:6379',
      GITHUB_TOKEN: 'ghp_test_token_123',
      GEMINI_API_KEY: undefined,
      MAX_SUPPORTED_FILES: 500,
      MAX_REPO_SIZE_MB: 50,
      HUB_THRESHOLD: 30,
      RUN_EMBEDDED_WORKER: false,
    });
  });

  it('parses explicit overrides including TLS rediss:// and boolean strings', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      DATABASE_URL: 'postgres://user:pass@ep-cool.neon.tech/neondb?sslmode=require',
      REDIS_URL: 'rediss://default:pass@upstash.io:6379',
      GITHUB_TOKEN: 'ghp_prod_token',
      GEMINI_API_KEY: 'AIzaSyTestKey',
      MAX_SUPPORTED_FILES: '300',
      MAX_REPO_SIZE_MB: '25',
      HUB_THRESHOLD: '45',
      RUN_EMBEDDED_WORKER: 'true',
    });

    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe('warn');
    expect(env.GEMINI_API_KEY).toBe('AIzaSyTestKey');
    expect(env.MAX_SUPPORTED_FILES).toBe(300);
    expect(env.MAX_REPO_SIZE_MB).toBe(25);
    expect(env.HUB_THRESHOLD).toBe(45);
    expect(env.RUN_EMBEDDED_WORKER).toBe(true);
  });

  it('parses RUN_EMBEDDED_WORKER="false" and "0" strictly as false (not truthy string)', () => {
    expect(parseEnv({ ...BASE_VALID_ENV, RUN_EMBEDDED_WORKER: 'false' }).RUN_EMBEDDED_WORKER).toBe(
      false,
    );
    expect(parseEnv({ ...BASE_VALID_ENV, RUN_EMBEDDED_WORKER: '0' }).RUN_EMBEDDED_WORKER).toBe(
      false,
    );
    expect(parseEnv({ ...BASE_VALID_ENV, RUN_EMBEDDED_WORKER: '1' }).RUN_EMBEDDED_WORKER).toBe(
      true,
    );
  });

  it('allows GITHUB_TOKEN to be omitted in test mode, but requires it in dev/prod', () => {
    const testEnv = parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: BASE_VALID_ENV.DATABASE_URL,
      REDIS_URL: BASE_VALID_ENV.REDIS_URL,
      GITHUB_TOKEN: '',
    });
    expect(testEnv.GITHUB_TOKEN).toBeUndefined();

    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: BASE_VALID_ENV.DATABASE_URL,
        REDIS_URL: BASE_VALID_ENV.REDIS_URL,
      }),
    ).toThrow(EnvValidationError);
  });

  it('fails fast and lists ALL invalid/missing variables in one readable error', () => {
    let caught: unknown;
    try {
      parseEnv({
        NODE_ENV: 'development',
        PORT: '70000',
        DATABASE_URL: 'https://not-postgres.example.com',
        REDIS_URL: 'not-a-url',
        MAX_SUPPORTED_FILES: '500abc',
        RUN_EMBEDDED_WORKER: 'maybe',
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(EnvValidationError);
    if (!(caught instanceof EnvValidationError)) {
      throw new Error('Expected EnvValidationError');
    }

    const paths = caught.issues.map((issue) => issue.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'PORT',
        'DATABASE_URL',
        'REDIS_URL',
        'MAX_SUPPORTED_FILES',
        'RUN_EMBEDDED_WORKER',
      ]),
    );
    expect(caught.message).toContain('Invalid environment configuration:');
    expect(caught.message).toContain('PORT');
    expect(caught.message).toContain('DATABASE_URL');
    expect(caught.message).toContain('REDIS_URL');
  });
});

describe('findRepoRoot and loadEnv', () => {
  it('resolves the monorepo root regardless of current working directory', () => {
    const repoRoot = findRepoRoot();
    const pkg: unknown = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(pkg).toHaveProperty('name', 'archon');
    expect(pkg).toHaveProperty('workspaces');
    expect(Array.isArray((pkg as { workspaces: unknown }).workspaces)).toBe(true);
  });

  it('loads variables from an explicit .env file path via dotenv', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'archon-env-test-'));
    const tempEnvFile = path.join(tempDir, '.env');
    const savedKeys = ['DATABASE_URL', 'REDIS_URL', 'GITHUB_TOKEN', 'NODE_ENV', 'HUB_THRESHOLD'];
    const backup = Object.fromEntries(savedKeys.map((k) => [k, process.env[k]]));

    try {
      for (const key of savedKeys) {
        Reflect.deleteProperty(process.env, key);
      }

      writeFileSync(
        tempEnvFile,
        [
          'NODE_ENV=test',
          'DATABASE_URL=postgresql://archon:pass@127.0.0.1:5432/archon',
          'REDIS_URL=redis://127.0.0.1:6379',
          'HUB_THRESHOLD=42',
        ].join('\n'),
        'utf8',
      );

      const env = loadEnv({ envFilePath: tempEnvFile, loadDotenvFile: true });
      expect(env.HUB_THRESHOLD).toBe(42);
      expect(env.NODE_ENV).toBe('test');
    } finally {
      for (const [key, value] of Object.entries(backup)) {
        if (value === undefined) {
          Reflect.deleteProperty(process.env, key);
        } else {
          process.env[key] = value;
        }
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

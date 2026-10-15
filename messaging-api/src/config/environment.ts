import { isEmail } from 'class-validator';

export function validateEnvironment(env: Record<string, unknown>) {
  const port = (key: string, fallback: number) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(`${key} must be a port between 1 and 65535`);
    }
    return value;
  };
  for (const key of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']) {
    if (typeof env[key] !== 'string' || !env[key].trim()) {
      throw new Error(`${key} is required; configure .env using .env.example`);
    }
  }
  if (
    env.SMS_MOCK_FAIL_ALL !== undefined &&
    env.SMS_MOCK_FAIL_ALL !== 'true' &&
    env.SMS_MOCK_FAIL_ALL !== 'false'
  ) {
    throw new Error('SMS_MOCK_FAIL_ALL must be true or false');
  }
  if (env.CORS_ORIGINS !== undefined && typeof env.CORS_ORIGINS !== 'string') {
    throw new Error('CORS_ORIGINS must be a string');
  }
  const origins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error('CORS_ORIGINS must contain comma-separated HTTP origins');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(
        'CORS_ORIGINS must contain exact HTTP origins without paths',
      );
    }
  }
  const smtp: Record<string, string> = {};
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
    if (env[key] !== undefined && typeof env[key] !== 'string') {
      throw new Error(`${key} must be a string`);
    }
    const value = env[key] ?? '';
    smtp[key] = key === 'SMTP_PASS' ? value : value.trim();
  }
  if (smtp.SMTP_FROM && !isEmail(smtp.SMTP_FROM))
    throw new Error(
      'SMTP_FROM must be a single email address without a display name',
    );
  if (
    env.SMTP_SECURE !== undefined &&
    env.SMTP_SECURE !== '' &&
    env.SMTP_SECURE !== 'true' &&
    env.SMTP_SECURE !== 'false'
  ) {
    throw new Error('SMTP_SECURE must be true or false');
  }
  return {
    ...env,
    ...smtp,
    SMTP_PORT: env.SMTP_PORT === '' ? 587 : port('SMTP_PORT', 587),
    SMTP_SECURE: env.SMTP_SECURE || 'false',
    PORT: port('PORT', 3000),
    DB_PORT: port('DB_PORT', 5432),
    CORS_ORIGINS: origins.join(','),
    SMS_MOCK_FAIL_ALL: env.SMS_MOCK_FAIL_ALL ?? 'false',
  };
}

import { validateEnvironment } from './environment';

const database = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_DATABASE: 'test',
};

describe('Environment', () => {
  it('defaults to mock email without requiring SMTP', () => {
    expect(validateEnvironment(database)).toMatchObject({
      EMAIL_PROVIDER: 'MOCK',
      DEMO_SEED_ENABLED: 'false',
    });
  });
  it('disables demo seeding in production even when requested', () => {
    expect(
      validateEnvironment({
        ...database,
        NODE_ENV: 'production',
        DEMO_SEED_ENABLED: 'true',
      }).DEMO_SEED_ENABLED,
    ).toBe('false');
  });
  it('rejects invalid provider and seed flags', () => {
    expect(() =>
      validateEnvironment({ ...database, EMAIL_PROVIDER: 'other' }),
    ).toThrow('EMAIL_PROVIDER');
    expect(() =>
      validateEnvironment({ ...database, DEMO_SEED_ENABLED: 'yes' }),
    ).toThrow('DEMO_SEED_ENABLED');
  });
});

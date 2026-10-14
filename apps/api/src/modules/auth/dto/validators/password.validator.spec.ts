import { IsStrongPasswordConstraint } from './password.validator';

describe('IsStrongPasswordConstraint', () => {
  let validator: IsStrongPasswordConstraint;

  beforeEach(() => {
    validator = new IsStrongPasswordConstraint();
  });

  it('accepts a strong password', () => {
    expect(validator.validate('Abcdefg1')).toBe(true);
  });

  it('rejects passwords shorter than 8 chars', () => {
    expect(validator.validate('Ab1')).toBe(false);
  });

  it('rejects passwords without an uppercase letter', () => {
    expect(validator.validate('abcdefg1')).toBe(false);
  });

  it('rejects passwords without a digit', () => {
    expect(validator.validate('Abcdefgh')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(validator.validate(12345678 as any)).toBe(false);
    expect(validator.validate(undefined as any)).toBe(false);
    expect(validator.validate(null as any)).toBe(false);
  });

  it('defaultMessage returns Ukrainian hint', () => {
    const msg = validator.defaultMessage();
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});

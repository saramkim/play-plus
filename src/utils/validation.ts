import { SubKeyConfig, SubtitleConfig } from './storage';

export const VALIDATION_RULE: { [key: string]: ValidationRule } = {
  fontSize: { type: 'number', min: 1, max: 10 },
  fontWeight: { type: 'number', min: 1, max: 6 },
  forward: { type: 'string' },
  backward: { type: 'string' },
  skipTime: { type: 'number', min: 1 },
};

export const validate = (key: string, value: any): ValidationSuccess | ValidationFailure => {
  const rule = VALIDATION_RULE[key];

  if (!rule) return { valid: true };

  if (typeof value !== rule.type) {
    const MAP = { string: '텍스트', number: '숫자' };
    return { valid: false, error: `${MAP[rule.type]}만 입력할 수 있습니다.` };
  }

  if (typeof value === 'string') {
    const { minLength, maxLength } = rule;
    if (maxLength !== undefined && value.length > maxLength)
      return { valid: false, error: `최대 길이 ${maxLength}를 초과합니다.` };
    if (minLength !== undefined && value.length < minLength)
      return { valid: false, error: `최소 길이 ${minLength}보다 짧습니다.` };
  }

  if (typeof value === 'number') {
    const { min, max } = rule;
    if (Number.isNaN(value)) return { valid: false, error: '숫자만 입력할 수 있습니다.' };
    if (max !== undefined && value > max) return { valid: false, error: `최대값 ${max}를 초과합니다.` };
    if (min !== undefined && value < min) return { valid: false, error: `최소값 ${min}보다 작습니다.` };
  }

  if (rule.validate && !rule.validate(value)) return { valid: false, error: `입력값이 올바르지 않습니다.` };

  return { valid: true };
};

export const validateAll = (target: SubKeyConfig | SubtitleConfig, prop: string, value: any) => {
  return (
    validate(prop, value).valid &&
    Object.entries(target).every(([key, value]) => (key === prop ? true : validate(key, value).valid))
  );
};

type ValidationRule = {
  type: 'string' | 'number';
  min?: number;
  max?: number;
  maxLength?: number;
  minLength?: number;
  validate?: (value: any) => boolean;
};

type ValidationSuccess = {
  valid: true;
  error?: never;
};

type ValidationFailure = {
  valid: false;
  error: string;
};

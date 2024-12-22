import { RESERVED_KEY_CODE_LIST } from './constants';
import { getMessage } from './i18n';
import { SubtitleConfig, VideoSkipConfig } from './storage';

export type ValidationResult = ValidationSuccess | ValidationFailure;

export const VALIDATION_RULE: { [key: string]: ValidationRule } = {
  fontSize: { type: 'number', min: 1, max: 10 },
  fontWeight: { type: 'number', min: 1, max: 6 },
  opacity: { type: 'number', min: 0, max: 100 },
  forward: { type: 'string', validate: validateNoReservedKey },
  backward: { type: 'string', validate: validateNoReservedKey },
  skipTime: { type: 'number', min: 1 },
  positionOffset: { type: 'number' },
};

export const validate = (key: string, value: any): ValidationResult => {
  const rule = VALIDATION_RULE[key];

  if (!rule) return { valid: true };

  if (typeof value !== rule.type) {
    const MAP = {
      string: getMessage('error_text_type'),
      number: getMessage('error_number_type'),
    };
    return { valid: false, error: MAP[rule.type] };
  }

  if (typeof value === 'string') {
    const { minLength, maxLength } = rule;
    if (maxLength !== undefined && value.length > maxLength)
      return {
        valid: false,
        error: getMessage('error_max_length', String(maxLength)),
      };
    if (minLength !== undefined && value.length < minLength)
      return {
        valid: false,
        error: getMessage('error_min_length', String(minLength)),
      };
  }

  if (typeof value === 'number') {
    const { min, max } = rule;
    if (Number.isNaN(value)) return { valid: false, error: getMessage('error_number_type') };
    if (max !== undefined && value > max)
      return {
        valid: false,
        error: getMessage('error_max_value', String(max)),
      };
    if (min !== undefined && value < min)
      return {
        valid: false,
        error: getMessage('error_min_value', String(min)),
      };
  }

  if (rule.validate && !rule.validate(value).valid) {
    const { valid, error } = rule.validate(value);
    return valid ? { valid } : { valid, error };
  }

  return { valid: true };
};

export const validateAll = (target: VideoSkipConfig | SubtitleConfig, prop: string, value: any): ValidationResult => {
  const result = validate(prop, value);
  if (!result.valid) return result;

  for (const [key, val] of Object.entries(target)) {
    if (key === prop) continue;
    const result = validate(key, val);
    if (!result.valid) return result;
  }

  return { valid: true };
};

function validateNoReservedKey(value: string): ValidationResult {
  return RESERVED_KEY_CODE_LIST.includes(value)
    ? { valid: false, error: getMessage('error_reserved_key') }
    : { valid: true };
}

type ValidationRule = {
  type: 'string' | 'number';
  min?: number;
  max?: number;
  maxLength?: number;
  minLength?: number;
  validate?: (value: any) => ValidationResult;
};

type ValidationSuccess = {
  valid: true;
  error?: never;
};

type ValidationFailure = {
  valid: false;
  error: string;
};

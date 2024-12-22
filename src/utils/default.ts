import { StorageSchema } from './storage';

export const DEFAULT_CONFIG: StorageSchema = {
  primarySubtitle: {
    enabled: false,
    language: 'en',
    positionReference: 'bottom',
    positionOffset: 100,
    color: '#ffffff',
    fontSize: 5,
    fontWeight: 3,
    opacity: 100,
    lineBreak: true,
  },
  secondarySubtitle: {
    enabled: false,
    language: 'ko',
    positionReference: 'bottom',
    positionOffset: 0,
    color: '#ffffff',
    fontSize: 5,
    fontWeight: 3,
    opacity: 100,
    lineBreak: true,
  },
  videoSkip: {
    enabled: true,
    forward: 'ArrowRight',
    backward: 'ArrowLeft',
    skipTime: 10,
  },
  subVideoSkip: {
    enabled: false,
    forward: '',
    backward: '',
    skipTime: 10,
  },
};

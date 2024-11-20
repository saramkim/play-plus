import { StorageSchema } from './storage';

export const DEFAULT_CONFIG: StorageSchema = {
  primarySubtitle: {
    enabled: false,
    language: 'en',
    color: '#ffffff',
    fontSize: 5,
    fontWeight: 3,
    opacity: 100,
    lineBreak: true,
  },
  secondarySubtitle: {
    enabled: false,
    language: 'ko',
    color: '#ffffff',
    fontSize: 5,
    fontWeight: 3,
    opacity: 100,
    lineBreak: true,
  },
  skipTime: 10,
  subKey: {
    enabled: false,
    forward: '',
    backward: '',
    skipTime: 10,
  },
  video: {
    subtitlePosition: 0,
    subtitleGap: 0,
  },
};

import { SubKeyConfig, SubtitleConfig } from './storage';

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  enabled: false,
  color: '#ffffff',
  fontSize: 5,
  fontWeight: 3,
  opacity: 100,
};

export const DEFAULT_SKIP_TIME = 10;

export const DEFAULT_SUB_KEY_CONFIG: SubKeyConfig = {
  enabled: false,
  forward: '',
  backward: '',
  skipTime: 10,
};

import { SubKeyConfig, SubtitleConfig } from './storage';

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  enabled: false,
  color: '#ffffff',
  fontSize: 5,
};

export const DEFAULT_SKIP_TIME = 10;

export const DEFAULT_SUB_KEY_CONFIG: SubKeyConfig = {
  forward: '',
  backward: '',
  skipTime: 10,
};

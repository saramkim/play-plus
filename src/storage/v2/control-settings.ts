import { z } from 'zod';

export const CONTROL_COMMANDS = [
  'saveCard', 'saveLearning', 'saveSupport', 'copyLearning', 'copySupport',
  'toggleLearning', 'toggleSupport', 'previousCue', 'nextCue',
  'secondaryPrevious', 'secondaryNext', 'repeatCurrentCue', 'playOnce',
  'toggleAB', 'setA', 'setB',
] as const;

export type ControlCommand = (typeof CONTROL_COMMANDS)[number];

export const navigationProfileSchema = z.object({
  amount: z.number().finite().positive(),
  unit: z.enum(['seconds', 'minutes', 'subtitles']),
  fallbackEnabled: z.boolean(),
  fallbackAmount: z.number().finite().nonnegative(),
  fallbackUnit: z.enum(['seconds', 'minutes']),
}).strict().refine(({ amount, unit }) => unit !== 'subtitles' || Number.isInteger(amount), {
  message: 'Cue movement must be an integer', path: ['amount'],
});

export type NavigationProfile = z.infer<typeof navigationProfileSchema>;

export const CONTROL_LABELS = {
  saveCard: 'v2_save_learning_card', saveLearning: 'v2_save_learning_only',
  saveSupport: 'v2_save_support_only', copyLearning: 'v2_copy_learning', copySupport: 'v2_copy_support',
  toggleLearning: 'v2_toggle_learning', toggleSupport: 'v2_toggle_support',
  previousCue: 'v2_primary_previous', nextCue: 'v2_primary_next',
  secondaryPrevious: 'v2_secondary_previous', secondaryNext: 'v2_secondary_next',
  repeatCurrentCue: 'v2_repeat_current_learning_cue', playOnce: 'v2_play_once',
  toggleAB: 'v2_toggle_ab', setA: 'v2_set_a', setB: 'v2_set_b',
} as const;

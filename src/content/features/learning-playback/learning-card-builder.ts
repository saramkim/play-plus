import { LearningCard, V2SubtitleCue } from '@storage/v2/type';
import { Language } from '@utils/constants';

import { resolveLearningCueCommand } from '@/content/features/learning-playback/learning-playback';
import { alignSupportCues } from '@/content/features/learning-playback/support-alignment';
import { learningCardSchema } from '@/storage/v2/schema';

export type LearningCardBuildResult =
  | { status: 'created'; card: LearningCard }
  | { status: 'no-current-cue' };

interface BuildLearningCardInput {
  learningCues: V2SubtitleCue[];
  learningDelaySeconds?: number;
  supportCues?: V2SubtitleCue[];
  supportDelaySeconds?: number;
  currentTime: number;
  learningLanguage: Language;
  supportLanguage: Language | null;
  url: string;
  idFactory?: () => string;
  createdAtFactory?: () => string;
}

export const buildLearningCard = ({
  learningCues,
  learningDelaySeconds = 0,
  supportCues = [],
  supportDelaySeconds = 0,
  currentTime,
  learningLanguage,
  supportLanguage,
  url,
  idFactory = createLearningCardId,
  createdAtFactory = () => new Date().toISOString(),
}: BuildLearningCardInput): LearningCardBuildResult => {
  const learningResult = resolveLearningCueCommand({
    command: 'save',
    cues: learningCues,
    currentTime,
    delaySeconds: learningDelaySeconds,
  });
  if (learningResult.status !== 'resolved') return { status: 'no-current-cue' };

  const support = supportLanguage
    ? alignSupportCues({ learningCue: learningResult.cue, supportCues, supportDelaySeconds })
    : undefined;
  const card = learningCardSchema.parse({
    id: idFactory(),
    content: {
      learning: { text: learningResult.cue.cue.text, language: learningLanguage },
      ...(support && supportLanguage
        ? { support: { text: support.text, language: supportLanguage } }
        : {}),
    },
    source: {
      url,
      startTime: learningResult.cue.startMs / 1000,
      endTime: learningResult.cue.endMs / 1000,
    },
    studyState: 'active',
    createdAt: createdAtFactory(),
  });

  return { status: 'created', card };
};

const createLearningCardId = () => `card-${crypto.randomUUID()}`;

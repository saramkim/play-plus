import { LearningCard, V2SubtitleCue } from '@storage/v2/type';
import { Language } from '@utils/constants';
import { stripTags } from '@utils/helper';

import {
  ResolvedLearningCue,
  resolveLearningCueCommand,
} from '@/content/features/learning-playback/learning-playback';
import { alignSupportCues } from '@/content/features/learning-playback/support-alignment';
import { learningCardSchema } from '@/storage/v2/schema';

type CreatedLearningCardBuildResult = { status: 'created'; card: LearningCard };

export type LearningCardBuildResult =
  | CreatedLearningCardBuildResult
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

interface BuildLearningCardFromResolvedCueInput {
  learningCue: ResolvedLearningCue;
  supportCues?: V2SubtitleCue[];
  supportDelaySeconds?: number;
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

  return buildLearningCardFromResolvedCue({
    learningCue: learningResult.cue,
    supportCues,
    supportDelaySeconds,
    learningLanguage,
    supportLanguage,
    url,
    idFactory,
    createdAtFactory,
  });
};

export const buildLearningCardFromResolvedCue = ({
  learningCue,
  supportCues = [],
  supportDelaySeconds = 0,
  learningLanguage,
  supportLanguage,
  url,
  idFactory = createLearningCardId,
  createdAtFactory = () => new Date().toISOString(),
}: BuildLearningCardFromResolvedCueInput): LearningCardBuildResult => {
  const learningText = stripTags(learningCue.cue.text);
  if (learningText.length === 0) return { status: 'no-current-cue' };

  const support = supportLanguage
    ? alignSupportCues({ learningCue, supportCues, supportDelaySeconds })
    : undefined;

  const card = learningCardSchema.parse({
    id: idFactory(),
    content: {
      learning: { text: learningText, language: learningLanguage },
      ...(support && supportLanguage
        ? { support: { text: support.text, language: supportLanguage } }
        : {}),
    },
    source: {
      url,
      startTime: learningCue.startMs / 1000,
      endTime: learningCue.endMs / 1000,
    },
    studyState: 'active',
    createdAt: createdAtFactory(),
  });

  return { status: 'created', card };
};

const createLearningCardId = () => `card-${crypto.randomUUID()}`;

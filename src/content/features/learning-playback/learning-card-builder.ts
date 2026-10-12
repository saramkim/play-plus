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

interface BuildLearningCardFromListeningSegmentInput {
  answerText: string;
  supportText?: string;
  startMs: number;
  endMs: number;
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

  return createAssignedLearningCard({
    learningText,
    ...(support ? { supportText: support.text } : {}),
    startMs: learningCue.startMs,
    endMs: learningCue.endMs,
    learningLanguage,
    supportLanguage,
    url,
    idFactory,
    createdAtFactory,
  });
};

export const buildLearningCardFromListeningSegment = ({
  answerText,
  supportText,
  startMs,
  endMs,
  learningLanguage,
  supportLanguage,
  url,
  idFactory = createLearningCardId,
  createdAtFactory = () => new Date().toISOString(),
}: BuildLearningCardFromListeningSegmentInput): LearningCardBuildResult => {
  if (answerText.trim().length === 0) return { status: 'no-current-cue' };

  return createAssignedLearningCard({
    learningText: answerText,
    ...(supportText === undefined ? {} : { supportText }),
    startMs,
    endMs,
    learningLanguage,
    supportLanguage,
    url,
    idFactory,
    createdAtFactory,
  });
};

interface CreateAssignedLearningCardInput {
  learningText: string;
  supportText?: string;
  startMs: number;
  endMs: number;
  learningLanguage: Language;
  supportLanguage: Language | null;
  url: string;
  idFactory: () => string;
  createdAtFactory: () => string;
}

const createAssignedLearningCard = ({
  learningText,
  supportText,
  startMs,
  endMs,
  learningLanguage,
  supportLanguage,
  url,
  idFactory,
  createdAtFactory,
}: CreateAssignedLearningCardInput): LearningCardBuildResult => {
  const card = learningCardSchema.parse({
    id: idFactory(),
    content: {
      learning: { text: learningText, language: learningLanguage },
      ...(supportText && supportLanguage
        ? { support: { text: supportText, language: supportLanguage } }
        : {}),
    },
    source: {
      url,
      startTime: startMs / 1000,
      endTime: endMs / 1000,
    },
    studyState: 'active',
    createdAt: createdAtFactory(),
  });

  return { status: 'created', card };
};

const createLearningCardId = () => `card-${crypto.randomUUID()}`;

export const buildRoleLearningCard = ({ role, cue, language, url }: {
  role: 'learning' | 'support'; cue: ResolvedLearningCue; language: Language; url: string;
}): LearningCardBuildResult => {
  const text = stripTags(cue.cue.text);
  if (!text.trim()) return { status: 'no-current-cue' };
  return { status: 'created', card: learningCardSchema.parse({
    id: createLearningCardId(), content: { [role]: { text, language } },
    source: { url, startTime: cue.startMs / 1000, endTime: cue.endMs / 1000 },
    studyState: 'active', createdAt: new Date().toISOString(),
  }) };
};

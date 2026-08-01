import { addRegisteredSubtitle } from '@storage/registered-subtitle';
import { Language } from '@utils/constants';
import { parseSubtitle } from '@utils/parse';

export const SUPPORTED_SUBTITLE_EXTENSIONS = ['.vtt', '.srt', '.smi'] as const;

export type SubtitleRegistrationErrorCode = 'unsupported-file-type' | 'empty-subtitle';

export class SubtitleRegistrationError extends Error {
  constructor(public readonly code: SubtitleRegistrationErrorCode) {
    super(code);
    this.name = 'SubtitleRegistrationError';
  }
}

export const isSupportedSubtitleFileName = (fileName: string) => {
  const normalizedFileName = fileName.toLowerCase();
  return SUPPORTED_SUBTITLE_EXTENSIONS.some((extension) => normalizedFileName.endsWith(extension));
};

export const subtitleTitleFromFileName = (fileName: string) => {
  const extension = SUPPORTED_SUBTITLE_EXTENSIONS.find((candidate) => fileName.toLowerCase().endsWith(candidate));
  return extension ? fileName.slice(0, -extension.length) : fileName;
};

export const registerSubtitleText = async ({
  fileName,
  title,
  language,
  text,
}: {
  fileName: string;
  title: string;
  language: Language;
  text: string;
}) => {
  const extension = SUPPORTED_SUBTITLE_EXTENSIONS.find((candidate) => fileName.toLowerCase().endsWith(candidate));
  if (!extension) throw new SubtitleRegistrationError('unsupported-file-type');

  const body = parseSubtitle[extension](text);
  if (body.length === 0) throw new SubtitleRegistrationError('empty-subtitle');

  return addRegisteredSubtitle({ title: title.trim(), language, body });
};

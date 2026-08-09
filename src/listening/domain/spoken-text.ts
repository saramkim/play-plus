import { stripTags } from '@utils/helper';

const supportedWrapperPairs: Readonly<Record<string, string>> = {
  '[': ']',
  '(': ')',
  '［': '］',
  '（': '）',
  '【': '】',
};
const supportedClosingWrappers = new Set(Object.values(supportedWrapperPairs));
const spokenCharacterPattern = /[\p{L}\p{N}]/u;

interface OpenWrapper {
  end: string;
  startIndex: number;
}

interface RemovedRange {
  endIndex: number;
  startIndex: number;
}

export const normalizeListeningWhitespace = (text: string) => {
  return text.replace(/\s+/gu, ' ').trim();
};

export const removeListeningNonSpokenWrappers = (text: string) => {
  const stack: OpenWrapper[] = [];
  const removedRanges: RemovedRange[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const expectedEnd = supportedWrapperPairs[character];
    if (expectedEnd !== undefined) {
      stack.push({
        end: expectedEnd,
        startIndex: stack.length === 0 ? index : stack[0].startIndex,
      });
      continue;
    }
    if (!supportedClosingWrappers.has(character) || stack.length === 0) continue;

    const current = stack.at(-1)!;
    if (current.end !== character) {
      stack.length = 0;
      continue;
    }

    stack.pop();
    if (stack.length === 0) {
      removedRanges.push({ startIndex: current.startIndex, endIndex: index });
    }
  }

  if (removedRanges.length === 0) return text;

  let result = '';
  let cursor = 0;
  for (const range of removedRanges) {
    result += text.slice(cursor, range.startIndex);
    cursor = range.endIndex + 1;
  }
  return result + text.slice(cursor);
};

export const cleanListeningSpokenText = (text: string) => {
  return normalizeListeningWhitespace(
    removeListeningNonSpokenWrappers(stripTags(text))
  );
};

export const hasListeningSpokenContent = (text: string) => {
  return spokenCharacterPattern.test(text);
};

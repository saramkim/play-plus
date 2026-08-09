type GraphemeSegment = {
  segment: string;
};

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<GraphemeSegment>;
};

type GraphemeSegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' }
) => GraphemeSegmenter;

const COMBINING_MARK_PATTERN = /^\p{Mark}$/u;
const REGIONAL_INDICATOR_PATTERN = /^[\u{1f1e6}-\u{1f1ff}]$/u;

const ZERO_WIDTH_JOINER = '\u200d';

export const splitListeningGraphemes = (input: string): string[] => {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: GraphemeSegmenterConstructor }).Segmenter;

  if (Segmenter === undefined) return splitListeningGraphemesFallback(input);

  const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(input), ({ segment }) => segment);
};

export const splitListeningGraphemesFallback = (input: string): string[] => {
  const clusters: string[] = [];

  for (const codePoint of input) {
    const previous = clusters.at(-1);

    if (previous === undefined) {
      clusters.push(codePoint);
      continue;
    }

    if (
      isCombiningExtension(codePoint) ||
      codePoint === ZERO_WIDTH_JOINER ||
      previous.endsWith(ZERO_WIDTH_JOINER) ||
      isCrLfPair(previous, codePoint) ||
      isRegionalIndicatorPair(previous, codePoint) ||
      isHangulContinuation(previous, codePoint)
    ) {
      clusters[clusters.length - 1] += codePoint;
      continue;
    }

    clusters.push(codePoint);
  }

  return clusters;
};

export const countListeningGraphemes = (input: string): number => splitListeningGraphemes(input).length;

const isCombiningExtension = (codePoint: string): boolean => {
  const value = codePoint.codePointAt(0);

  if (value === undefined) return false;

  return (
    COMBINING_MARK_PATTERN.test(codePoint) ||
    value === 0x200c ||
    (value >= 0xfe00 && value <= 0xfe0f) ||
    (value >= 0x1f3fb && value <= 0x1f3ff) ||
    (value >= 0xe0020 && value <= 0xe007f) ||
    (value >= 0xe0100 && value <= 0xe01ef)
  );
};

const isCrLfPair = (previous: string, codePoint: string): boolean => previous === '\r' && codePoint === '\n';

const isRegionalIndicatorPair = (previous: string, codePoint: string): boolean => {
  if (!REGIONAL_INDICATOR_PATTERN.test(codePoint)) return false;

  const regionalIndicatorCount = Array.from(previous).filter((part) => REGIONAL_INDICATOR_PATTERN.test(part)).length;
  return regionalIndicatorCount % 2 === 1;
};

type HangulClass = 'l' | 'v' | 't' | 'lv' | 'lvt' | undefined;

const isHangulContinuation = (previous: string, codePoint: string): boolean => {
  const previousCodePoint = Array.from(previous).at(-1)?.codePointAt(0);
  const nextCodePoint = codePoint.codePointAt(0);

  if (previousCodePoint === undefined || nextCodePoint === undefined) return false;

  const previousClass = getHangulClass(previousCodePoint);
  const nextClass = getHangulClass(nextCodePoint);

  return (
    (previousClass === 'l' && (nextClass === 'l' || nextClass === 'v' || nextClass === 'lv' || nextClass === 'lvt')) ||
    ((previousClass === 'lv' || previousClass === 'v') && (nextClass === 'v' || nextClass === 't')) ||
    ((previousClass === 'lvt' || previousClass === 't') && nextClass === 't')
  );
};

const getHangulClass = (value: number): HangulClass => {
  if (
    (value >= 0x1100 && value <= 0x115f) ||
    (value >= 0xa960 && value <= 0xa97c)
  ) {
    return 'l';
  }

  if (
    (value >= 0x1160 && value <= 0x11a7) ||
    (value >= 0xd7b0 && value <= 0xd7c6)
  ) {
    return 'v';
  }

  if (
    (value >= 0x11a8 && value <= 0x11ff) ||
    (value >= 0xd7cb && value <= 0xd7fb)
  ) {
    return 't';
  }

  if (value < 0xac00 || value > 0xd7a3) return undefined;

  return (value - 0xac00) % 28 === 0 ? 'lv' : 'lvt';
};

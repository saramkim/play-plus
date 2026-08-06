import DOMPurify from 'dompurify';

export type SubtitleData = {
  start: number;
  end: number;
  text: string;
  settings?: string[];
};

const INITIAL_SUBTITLE: SubtitleData = { start: 0, end: 0, text: '' };

export const parseVTT = (data: string) => {
  if (!data || !data.trim()) return [];

  const subtitles: SubtitleData[] = [];
  const lines = data.split('\n');
  const startIndex = lines[0].includes('WEBVTT') ? 1 : 0;
  let currentSubtitle = { ...INITIAL_SUBTITLE };
  let inMetadataBlock = false; // NOTE, STYLE, REGION 블록 추적
  let hasTiming = false; // 시간 라인이 파싱되었는지 명시적 플래그

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    // NOTE, STYLE, REGION 블록 시작 감지
    if (/^(NOTE|STYLE|REGION)$/i.test(line)) {
      inMetadataBlock = true;
      continue;
    }

    // 메타데이터 블록 내부 처리: 빈 줄이 나오면 블록 종료
    if (inMetadataBlock) {
      if (line === '') {
        inMetadataBlock = false;
      }
      continue;
    }

    // 시간 라인 체크를 먼저 수행
    if (line.includes('-->')) {
      // 탭이나 여러 공백을 처리하기 위해 정규식 사용
      const timeMatch = line.match(/^(.+?)\s+-->\s+(.+?)(?:\s+(.+))?$/);
      if (timeMatch) {
        const [, start, end, options] = timeMatch;
        const startTime = timeToSeconds(start.trim());
        const endTime = timeToSeconds(end.trim());
        if (startTime === null || endTime === null) continue;

        currentSubtitle.start = startTime;
        currentSubtitle.end = endTime;
        if (options) {
          currentSubtitle.settings = options.trim().split(/\s+/);
        }
        hasTiming = true;
      }
      continue;
    }

    // 빈 줄 처리: 자막 블록 종료
    if (line === '') {
      if (currentSubtitle.text.trim() && hasTiming) {
        subtitles.push({ ...currentSubtitle });
      }
      currentSubtitle = { ...INITIAL_SUBTITLE };
      hasTiming = false;
      continue;
    }

    // Cue identifier/인덱스 처리: 시간이 아직 파싱되지 않은 상태에서만 체크
    // (즉, 빈 줄 이후 새로운 블록 시작 시에만)
    if (!hasTiming) {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      if (nextLine.includes('-->')) {
        continue; // Cue identifier 또는 인덱스로 간주하고 무시
      }
    }

    // 자막 텍스트 추가
    currentSubtitle.text += (currentSubtitle.text ? '\n' : '') + sanitize(line);
  }

  // 마지막 자막 블록 처리
  if (currentSubtitle.text.trim() && hasTiming) {
    subtitles.push({ ...currentSubtitle });
  }

  return subtitles;
};

export const parseSRT = (data: string) => {
  if (!data || !data.trim()) return [];

  const subtitles: SubtitleData[] = [];
  const lines = data.split(/\r?\n/);
  let currentSubtitle = { ...INITIAL_SUBTITLE };
  let step = 0; // 0: 인덱스, 1: 시간, 2: 텍스트, 3: 잘못된 cue

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      if (step === 2 && currentSubtitle.text.trim()) {
        subtitles.push({ ...currentSubtitle });
      }
      currentSubtitle = { ...INITIAL_SUBTITLE };
      step = 0;
      continue;
    }

    if (step === 0 && /^\d+$/.test(line)) {
      step = 1;
    } else if (step === 1 && line.includes('-->')) {
      const timeMatch = line.match(/^(.+?)\s+-->\s+(.+)$/);
      if (!timeMatch) {
        step = 3;
        continue;
      }
      const start = srtTimeToSeconds(timeMatch[1].trim());
      const end = srtTimeToSeconds(timeMatch[2].trim());
      if (start === null || end === null || end < start) {
        step = 3;
        continue;
      }
      currentSubtitle.start = start;
      currentSubtitle.end = end;
      step = 2;
    } else if (step === 2) {
      currentSubtitle.text += (currentSubtitle.text ? '\n' : '') + sanitize(line);
    }
  }

  if (step === 2 && currentSubtitle.text.trim()) {
    subtitles.push({ ...currentSubtitle });
  }

  return subtitles;
};

export const parseSMI = (data: string) => {
  if (!data || !data.trim()) return [];

  const subtitles: SubtitleData[] = [];
  const syncRegex = /<SYNC\s+Start=(\d+)>/gi;
  const tagRegex = /<[^>]+>/g;
  const nbspRegex = /&nbsp;/g; // &nbsp; 제거
  let match;

  while ((match = syncRegex.exec(data)) !== null) {
    const start = parseInt(match[1], 10) / 1000; // ms를 초로 변환
    const nextMatch = syncRegex.exec(data);
    const end = nextMatch ? parseInt(nextMatch[1], 10) / 1000 : start + 2; // 다음 SYNC 또는 기본 길이 2초

    const textStart = match.index + match[0].length;
    const textEnd = nextMatch ? nextMatch.index : data.length;
    const text = data.substring(textStart, textEnd).replace(tagRegex, '').replace(nbspRegex, '').trim();

    if (text) {
      subtitles.push({ start, end, text: sanitize(text) });
    }
  }

  return subtitles;
};

export const parseSubtitle = {
  '.vtt': parseVTT,
  '.srt': parseSRT,
  '.smi': parseSMI,
};

export const getSubtitleFormat = (file: File): keyof typeof parseSubtitle | undefined => {
  const extensions = Object.keys(parseSubtitle);
  for (const extension of extensions) {
    if (file.name.toLowerCase().endsWith(extension)) return extension;
  }
  return;
};

const sanitize = (dirtyText: string) => {
  return DOMPurify.sanitize(dirtyText, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'c', 'v', 'lang', 'ruby', 'rt'],
    ALLOWED_ATTR: ['class', 'title', 'lang'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
};

const timeToSeconds = (time: string) => {
  const match = time.match(/^(?:(\d+):)?(\d{2}):(\d{2})([.,]\d+)?$/);
  if (!match) return null;

  const [, hours = '0', minutes, seconds, fraction = ''] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(`${seconds}${fraction.replace(',', '.')}`);
};

const srtTimeToSeconds = (time: string) => {
  const match = time.match(/^(?:(\d+):)?([0-5]\d):([0-5]\d)([.,]\d+)?$/);
  if (!match) return null;

  const [, hours = '0', minutes, seconds, fraction = ''] = match;
  const result =
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(`${seconds}${fraction.replace(',', '.')}`);
  return Number.isFinite(result) ? result : null;
};

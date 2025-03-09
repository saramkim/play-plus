export type SubtitleData = {
  start: number;
  end: number;
  text: string;
  settings?: string[];
};

export const parseVTT = (data: string) => {
  if (!data || !data.trim()) return [];

  const subtitles: SubtitleData[] = [];
  const lines = data.split('\n');
  const startIndex = lines[0].includes('WEBVTT') ? 1 : 0;
  let currentSubtitle: SubtitleData = { start: 0, end: 0, text: '' };

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      const [start, endAndOptions] = line.split(' --> ');
      const [end, ...options] = endAndOptions.split(/\s+/);
      currentSubtitle.start = timeToSeconds(start.trim());
      currentSubtitle.end = timeToSeconds(end.trim());
      if (options.length > 0) currentSubtitle.settings = options;
    } else if (line === '') {
      if (currentSubtitle.text.trim()) {
        subtitles.push({ ...currentSubtitle });
      }
      currentSubtitle = { start: 0, end: 0, text: '' };
    } else {
      currentSubtitle.text += (currentSubtitle.text ? '\n' : '') + line;
    }
  }

  if (currentSubtitle.text.trim()) {
    subtitles.push({ ...currentSubtitle });
  }

  return subtitles;
};

export const parseSRT = (data: string) => {
  if (!data || !data.trim()) return [];

  const subtitles: SubtitleData[] = [];
  const lines = data.split(/\r?\n/);
  let currentSubtitle = { start: 0, end: 0, text: '' };
  let step = 0; // 0: 인덱스, 1: 시간, 2: 텍스트

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      if (currentSubtitle.text.trim()) {
        subtitles.push({ ...currentSubtitle });
      }
      currentSubtitle = { start: 0, end: 0, text: '' };
      step = 0;
      continue;
    }

    if (step === 0 && /^\d+$/.test(line)) {
      step = 1;
    } else if (step === 1 && line.includes('-->')) {
      const [start, end] = line.split(' --> ').map((time) => timeToSeconds(time.trim().replace(',', '.')));
      currentSubtitle.start = start;
      currentSubtitle.end = end;
      step = 2;
    } else if (step === 2) {
      currentSubtitle.text += (currentSubtitle.text ? '\n' : '') + line;
    }
  }

  if (currentSubtitle.text.trim()) {
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
      subtitles.push({ start, end, text });
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

const timeToSeconds = (time: string) => {
  const parts = time.split(':').map(parseFloat);

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }

  return 0;
};

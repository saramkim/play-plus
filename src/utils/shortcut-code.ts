const PUNCTUATION_LABELS: Readonly<Record<string, string>> = {
  Backquote: '`',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Equal: '=',
  Minus: '-',
  Period: '.',
  Quote: "'",
  Semicolon: ';',
  Slash: '/',
};

const NAMED_LABELS: Readonly<Record<string, string>> = {
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  AudioVolumeDown: 'Volume Down',
  AudioVolumeMute: 'Mute',
  AudioVolumeUp: 'Volume Up',
  Backspace: 'Backspace',
  BrowserBack: 'Browser Back',
  BrowserFavorites: 'Browser Favorites',
  BrowserForward: 'Browser Forward',
  BrowserHome: 'Browser Home',
  BrowserRefresh: 'Browser Refresh',
  BrowserSearch: 'Browser Search',
  BrowserStop: 'Browser Stop',
  CapsLock: 'Caps Lock',
  ContextMenu: 'Menu',
  Delete: 'Delete',
  Eject: 'Eject',
  End: 'End',
  Enter: 'Enter',
  Escape: 'Esc',
  Help: 'Help',
  Home: 'Home',
  Insert: 'Insert',
  IntlBackslash: 'Intl \\',
  IntlRo: 'Intl Ro',
  IntlYen: 'Intl ¥',
  KanaMode: 'Kana Mode',
  LaunchApp1: 'App 1',
  LaunchApp2: 'App 2',
  LaunchMail: 'Mail',
  MediaPlayPause: 'Media Play/Pause',
  MediaSelect: 'Media Select',
  MediaStop: 'Media Stop',
  MediaTrackNext: 'Media Next',
  MediaTrackPrevious: 'Media Previous',
  NonConvert: 'Non-convert',
  NumLock: 'Num Lock',
  PageDown: 'Page Down',
  PageUp: 'Page Up',
  Pause: 'Pause',
  PrintScreen: 'Print Screen',
  ScrollLock: 'Scroll Lock',
  Space: 'Space',
  Tab: 'Tab',
};

const NUMPAD_LABELS: Readonly<Record<string, string>> = {
  Add: '+',
  Backspace: 'Backspace',
  Clear: 'Clear',
  ClearEntry: 'CE',
  Comma: ',',
  Decimal: '.',
  Divide: '/',
  Enter: 'Enter',
  Equal: '=',
  Hash: '#',
  MemoryAdd: 'Memory +',
  MemoryClear: 'Memory Clear',
  MemoryRecall: 'Memory Recall',
  MemoryStore: 'Memory Store',
  MemorySubtract: 'Memory -',
  Multiply: '×',
  ParenLeft: '(',
  ParenRight: ')',
  Star: '*',
  Subtract: '-',
};

const formatWords = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

const formatNumpadCode = (suffix: string, locale: string) => {
  const label = /^\d$/.test(suffix) ? suffix : (NUMPAD_LABELS[suffix] ?? formatWords(suffix));
  const prefix = locale.toLowerCase().startsWith('ko') ? '숫자패드' : 'Num';
  return `${prefix} ${label}`;
};

/**
 * Formats a stored KeyboardEvent.code for display without changing its physical-key identity.
 */
export const formatShortcutCode = (code: string, locale = 'en'): string => {
  if (code === '') return '';

  const letterMatch = /^Key([A-Z])$/.exec(code);
  if (letterMatch) return letterMatch[1];

  const digitMatch = /^Digit(\d)$/.exec(code);
  if (digitMatch) return digitMatch[1];

  if (/^F(?:[1-9]|1\d|2[0-4])$/.test(code)) return code;

  const numpadMatch = /^Numpad(.+)$/.exec(code);
  if (numpadMatch) return formatNumpadCode(numpadMatch[1], locale);

  const modifierMatch = /^(Alt|Control|Meta|Shift)(Left|Right)$/.exec(code);
  if (modifierMatch) return `${modifierMatch[2]} ${modifierMatch[1]}`;

  const languageMatch = /^Lang(\d+)$/.exec(code);
  if (languageMatch) return `Language ${languageMatch[1]}`;

  const fallback = formatWords(code);
  return PUNCTUATION_LABELS[code] ?? NAMED_LABELS[code] ?? (fallback || code);
};

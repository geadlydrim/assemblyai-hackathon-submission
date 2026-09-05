/**
 * Speaker-labelled SRT / VTT from AssemblyAI utterances.
 * Pure module: no SDK, no process.env, no network.
 *
 * Timestamps on utterances and words are milliseconds.
 */

/** Matches T04 completed-transcript `utterances[].words[]`. */
export type SubtitleWord = {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
};

/** Matches T04 completed-transcript `utterances[]`. `speaker` is typically `"A"`. */
export type SubtitleUtterance = {
  speaker: string;
  start: number;
  end: number;
  text: string;
  words?: SubtitleWord[];
};

export type SubtitleOptions = {
  /**
   * Split when adding the next word would exceed this count.
   * A single word always stays intact.
   */
  maxWordsPerCue?: number;
  /**
   * Split when adding the next word would make the cue *body*
   * (joined words only, not the `Speaker X:` prefix) exceed this length.
   * A single word always stays intact even if it is longer.
   */
  maxCharsPerCue?: number;
};

export const DEFAULT_MAX_WORDS_PER_CUE = 8;
export const DEFAULT_MAX_CHARS_PER_CUE = 42;

/** Valid empty WebVTT document. */
export const EMPTY_VTT = "WEBVTT\n\n";

type Cue = {
  startMs: number;
  endMs: number;
  text: string;
};

function resolveLimits(options?: SubtitleOptions): {
  maxWords: number;
  maxChars: number;
} {
  return {
    maxWords: options?.maxWordsPerCue ?? DEFAULT_MAX_WORDS_PER_CUE,
    maxChars: options?.maxCharsPerCue ?? DEFAULT_MAX_CHARS_PER_CUE,
  };
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** SRT clock: `HH:MM:SS,mmm` */
export function formatSrtTimestamp(ms: number): string {
  return formatClock(ms, ",");
}

/** VTT clock: `HH:MM:SS.mmm` */
export function formatVttTimestamp(ms: number): string {
  return formatClock(ms, ".");
}

function formatClock(ms: number, decimal: "," | "."): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${decimal}${pad(millis, 3)}`;
}

/**
 * Bare `A` / `B` / … → `Speaker A`. Already-prefixed labels are left as-is
 * (leading `speaker` is normalized to `Speaker`).
 */
export function formatSpeakerLabel(speaker: string): string | null {
  const trimmed = speaker.trim();
  if (!trimmed) {
    return null;
  }
  if (/^speaker\b/i.test(trimmed)) {
    return trimmed.replace(/^speaker/i, "Speaker");
  }
  return `Speaker ${trimmed}`;
}

function formatCueText(speaker: string, body: string): string {
  const label = formatSpeakerLabel(speaker);
  return label ? `${label}: ${body}` : body;
}

function joinWordText(words: SubtitleWord[]): string {
  return words.map((word) => word.text).join(" ");
}

function usableWords(words: SubtitleWord[] | undefined): SubtitleWord[] {
  if (!words?.length) {
    return [];
  }
  return words.filter((word) => word.text.trim().length > 0);
}

function wouldExceed(
  current: SubtitleWord[],
  next: SubtitleWord,
  maxWords: number,
  maxChars: number,
): boolean {
  if (current.length === 0) {
    return false;
  }
  if (current.length + 1 > maxWords) {
    return true;
  }
  return joinWordText([...current, next]).length > maxChars;
}

function splitUtterance(
  utterance: SubtitleUtterance,
  maxWords: number,
  maxChars: number,
): Cue[] {
  const words = usableWords(utterance.words);
  if (words.length === 0) {
    const body = utterance.text.trim();
    if (!body) {
      return [];
    }
    return [
      {
        startMs: utterance.start,
        endMs: utterance.end,
        text: formatCueText(utterance.speaker, body),
      },
    ];
  }

  const chunks: SubtitleWord[][] = [];
  let current: SubtitleWord[] = [];

  for (const word of words) {
    if (wouldExceed(current, word, maxWords, maxChars)) {
      chunks.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.map((chunk) => ({
    startMs: chunk[0].start,
    endMs: chunk[chunk.length - 1].end,
    text: formatCueText(utterance.speaker, joinWordText(chunk)),
  }));
}

function toCues(
  utterances: readonly SubtitleUtterance[] | null | undefined,
  options?: SubtitleOptions,
): Cue[] {
  if (!utterances?.length) {
    return [];
  }
  const { maxWords, maxChars } = resolveLimits(options);
  return utterances.flatMap((utterance) =>
    splitUtterance(utterance, maxWords, maxChars),
  );
}

/**
 * Build an SRT document. Empty input → `""`.
 * Cues are 1-based, separated by a blank line.
 */
export function utterancesToSrt(
  utterances: readonly SubtitleUtterance[] | null | undefined,
  options?: SubtitleOptions,
): string {
  const cues = toCues(utterances, options);
  if (cues.length === 0) {
    return "";
  }
  return (
    cues
      .map((cue, index) => {
        const start = formatSrtTimestamp(cue.startMs);
        const end = formatSrtTimestamp(cue.endMs);
        return `${index + 1}\n${start} --> ${end}\n${cue.text}`;
      })
      .join("\n\n") + "\n"
  );
}

/**
 * Build a WebVTT document. Empty input → `WEBVTT\\n\\n`.
 * File always starts with `WEBVTT` and a blank line. No cue HTML.
 */
export function utterancesToVtt(
  utterances: readonly SubtitleUtterance[] | null | undefined,
  options?: SubtitleOptions,
): string {
  const cues = toCues(utterances, options);
  if (cues.length === 0) {
    return EMPTY_VTT;
  }
  const body = cues
    .map((cue) => {
      const start = formatVttTimestamp(cue.startMs);
      const end = formatVttTimestamp(cue.endMs);
      return `${start} --> ${end}\n${cue.text}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

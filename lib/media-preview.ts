/**
 * Client-safe helpers for T09 media preview + labelled VTT cues.
 * No SDK, no process.env, no network.
 */

import { formatSpeakerLabel } from "@/lib/subtitles";
import type { TranscriptUtterance } from "@/lib/poll-transcript";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv)$/i;

export type PreviewCue = {
  startMs: number;
  endMs: number;
  text: string;
};

/** Same-origin labelled VTT for `<track src>` — never official. */
export function labelledVttSrc(transcriptId: string): string {
  return `/api/transcripts/${encodeURIComponent(transcriptId)}/subtitles?kind=labelled&format=vtt`;
}

export function isVideoFile(file: { type: string; name: string }): boolean {
  if (file.type.startsWith("video/")) {
    return true;
  }
  if (file.type.startsWith("audio/")) {
    return false;
  }
  return VIDEO_EXT.test(file.name);
}

/** VTT / display clock: `HH:MM:SS.mmm` */
export function formatCueClock(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}

export function parseVttTimestamp(clock: string): number {
  const trimmed = clock.trim();
  const match = trimmed.match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{1,3})$/);
  if (!match) {
    return 0;
  }
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3], 10);
  const millis = Number.parseInt(match[4].padEnd(3, "0"), 10);
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + millis;
}

/**
 * Minimal WebVTT cue parser for T05/T06 labelled output.
 * Skips NOTE/STYLE/REGION and optional cue identifiers.
 */
export function parseVttCues(vtt: string): PreviewCue[] {
  const lines = vtt.replace(/^\uFEFF/, "").split(/\r?\n/);
  const cues: PreviewCue[] = [];
  let i = 0;

  while (i < lines.length && lines[i].trim() === "") {
    i += 1;
  }
  if (lines[i]?.startsWith("WEBVTT")) {
    i += 1;
  }
  while (i < lines.length && lines[i].trim() !== "") {
    i += 1;
  }

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") {
      i += 1;
    }
    if (i >= lines.length) {
      break;
    }

    const header = lines[i].trim();
    if (
      header.startsWith("NOTE") ||
      header.startsWith("STYLE") ||
      header.startsWith("REGION")
    ) {
      i += 1;
      while (i < lines.length && lines[i].trim() !== "") {
        i += 1;
      }
      continue;
    }

    let timing = header;
    if (!timing.includes("-->")) {
      i += 1;
      if (i >= lines.length) {
        break;
      }
      timing = lines[i].trim();
    }
    if (!timing.includes("-->")) {
      i += 1;
      continue;
    }

    const timingMatch = timing.match(
      /^(\S+)\s+-->\s+(\S+?)(?:\s+.*)?$/,
    );
    i += 1;
    if (!timingMatch) {
      continue;
    }

    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i += 1;
    }
    const text = textLines.join("\n").trim();
    if (!text) {
      continue;
    }
    cues.push({
      startMs: parseVttTimestamp(timingMatch[1]),
      endMs: parseVttTimestamp(timingMatch[2]),
      text,
    });
  }

  return cues;
}

export function cuesFromUtterances(
  utterances: readonly TranscriptUtterance[] | null | undefined,
): PreviewCue[] {
  if (!utterances?.length) {
    return [];
  }
  const cues: PreviewCue[] = [];
  for (const utterance of utterances) {
    const body = utterance.text.trim();
    if (!body) {
      continue;
    }
    const label = formatSpeakerLabel(utterance.speaker);
    cues.push({
      startMs: utterance.start,
      endMs: utterance.end,
      text: label ? `${label}: ${body}` : body,
    });
  }
  return cues;
}

export function activeCueIndex(
  cues: readonly PreviewCue[],
  timeMs: number,
): number {
  for (let i = cues.length - 1; i >= 0; i -= 1) {
    const cue = cues[i];
    if (timeMs >= cue.startMs && timeMs < cue.endMs) {
      return i;
    }
  }
  return -1;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

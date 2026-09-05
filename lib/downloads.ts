/**
 * Client-safe helpers for T10 subtitle downloads and status copy.
 * No SDK, no process.env, no network.
 */

import type { TranscriptStatus } from "@/lib/poll-transcript";

export type SubtitleKind = "labelled" | "official";
export type SubtitleFormat = "srt" | "vtt";

export type SubtitleDownload = {
  kind: SubtitleKind;
  format: SubtitleFormat;
  label: string;
  description: string;
};

export const SUBTITLE_DOWNLOADS: readonly SubtitleDownload[] = [
  {
    kind: "labelled",
    format: "srt",
    label: "Labelled SRT",
    description: "Speaker A/B/C cues in SubRip format",
  },
  {
    kind: "labelled",
    format: "vtt",
    label: "Labelled VTT",
    description: "Speaker A/B/C cues in WebVTT format",
  },
  {
    kind: "official",
    format: "srt",
    label: "Official SRT",
    description: "AssemblyAI export without speaker names",
  },
  {
    kind: "official",
    format: "vtt",
    label: "Official VTT",
    description: "AssemblyAI export without speaker names",
  },
];

/** Same T06 route the player uses; official kind is download-only. */
export function subtitleDownloadHref(
  transcriptId: string,
  kind: SubtitleKind,
  format: SubtitleFormat,
): string {
  const id = encodeURIComponent(transcriptId.trim());
  return `/api/transcripts/${id}/subtitles?kind=${kind}&format=${format}`;
}

/** Matches T06 `Content-Disposition` filename. */
export function subtitleDownloadFilename(
  transcriptId: string,
  kind: SubtitleKind,
  format: SubtitleFormat,
): string {
  return `transcript-${transcriptId.trim()}-${kind}.${format}`;
}

export function downloadsEnabled(
  status: TranscriptStatus | null | undefined,
): boolean {
  return status === "completed";
}

export function emptyStateCopy(): string {
  return "No file chosen. Select an English audio or video file, then generate subtitles.";
}

export function uploadingCopy(): string {
  return "Uploading your file to AssemblyAI…";
}

export function queuedCopy(): string {
  return "Queued — AssemblyAI accepted the job and will start transcribing shortly.";
}

export function processingCopy(): string {
  return "Processing — transcribing speech and labelling speakers.";
}

export function formatUploadError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Upload failed.";
  }
  if (/^upload failed\b/i.test(trimmed)) {
    return trimmed;
  }
  return `Upload failed: ${trimmed}`;
}

export function formatTranscriptionError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Transcription failed.";
  }
  if (/^transcription failed\b/i.test(trimmed)) {
    return trimmed;
  }
  return `Transcription failed: ${trimmed}`;
}

export function formatSubtitleError(httpStatus: number, body: string): string {
  const parsed = parseJsonError(body);
  const raw = parsed ?? body.trim();
  const lower = raw.toLowerCase();

  if (
    httpStatus === 500 &&
    (lower.includes("no utterances") ||
      lower.includes("transcript text is empty") ||
      lower.includes("unable to create captions"))
  ) {
    return "Subtitles failed: this recording looks empty or silent, so no captions could be generated.";
  }

  if (raw) {
    if (/^subtitles failed\b/i.test(raw)) {
      return raw;
    }
    return `Subtitles failed: ${raw}`;
  }

  return `Subtitles failed (${httpStatus}).`;
}

function parseJsonError(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const data = JSON.parse(trimmed) as { error?: unknown };
    return typeof data.error === "string" && data.error.trim()
      ? data.error.trim()
      : null;
  } catch {
    return null;
  }
}

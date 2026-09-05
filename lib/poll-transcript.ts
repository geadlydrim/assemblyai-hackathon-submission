/** T04 poll contract. Keep in sync with `GET /api/transcripts/[id]`. */

export const POLL_INTERVAL_MS = 3000;

export type TranscriptStatus = "queued" | "processing" | "completed" | "error";

export type TranscriptWord = {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
};

export type TranscriptUtterance = {
  speaker: string;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
};

export type TranscriptPollResponse = {
  id: string;
  status: TranscriptStatus;
  error?: string | null;
  text?: string | null;
  audio_duration?: number | null;
  utterances?: TranscriptUtterance[] | null;
};

export type PollOutcome =
  | { kind: "in_progress"; transcript: TranscriptPollResponse }
  | { kind: "completed"; transcript: TranscriptPollResponse }
  | { kind: "job_error"; transcript: TranscriptPollResponse }
  | { kind: "fatal"; message: string }
  | { kind: "transient"; message: string };

const STATUSES = new Set<TranscriptStatus>([
  "queued",
  "processing",
  "completed",
  "error",
]);

const FATAL_HTTP = new Set([400, 401, 403, 404]);

export function shouldStartPolling(transcriptId: string | null | undefined): boolean {
  return typeof transcriptId === "string" && transcriptId.trim().length > 0;
}

function readErrorMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string" &&
    (body as { error: string }).error.trim()
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

function asTranscript(body: unknown): TranscriptPollResponse | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as {
    id?: unknown;
    status?: unknown;
    error?: unknown;
    text?: unknown;
    audio_duration?: unknown;
    utterances?: unknown;
  };
  if (typeof record.id !== "string" || !record.id.trim()) {
    return null;
  }
  if (typeof record.status !== "string" || !STATUSES.has(record.status as TranscriptStatus)) {
    return null;
  }

  const transcript: TranscriptPollResponse = {
    id: record.id,
    status: record.status as TranscriptStatus,
  };

  if (record.error === null || typeof record.error === "string") {
    transcript.error = record.error;
  }
  if (record.text === null || typeof record.text === "string") {
    transcript.text = record.text;
  }
  if (record.audio_duration === null || typeof record.audio_duration === "number") {
    transcript.audio_duration = record.audio_duration;
  }
  if (record.utterances === null || Array.isArray(record.utterances)) {
    transcript.utterances = record.utterances as TranscriptUtterance[] | null;
  }

  return transcript;
}

/** Decide whether a poll response should stop the loop. */
export function resolvePollResponse(
  httpStatus: number,
  body: unknown,
): PollOutcome {
  if (FATAL_HTTP.has(httpStatus)) {
    return {
      kind: "fatal",
      message: readErrorMessage(body, `Transcript request failed (${httpStatus}).`),
    };
  }

  if (httpStatus === 429 || httpStatus >= 500) {
    return {
      kind: "transient",
      message: readErrorMessage(body, `Transcript request failed (${httpStatus}).`),
    };
  }

  if (httpStatus !== 200) {
    return {
      kind: "fatal",
      message: readErrorMessage(body, `Transcript request failed (${httpStatus}).`),
    };
  }

  const transcript = asTranscript(body);
  if (!transcript) {
    return { kind: "transient", message: "Unexpected poll response." };
  }

  if (transcript.status === "completed") {
    return { kind: "completed", transcript };
  }
  if (transcript.status === "error") {
    return { kind: "job_error", transcript };
  }
  return { kind: "in_progress", transcript };
}

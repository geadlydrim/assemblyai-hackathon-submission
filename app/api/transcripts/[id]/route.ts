import { getClient } from "@/lib/assemblyai";

const KNOWN_STATUSES = new Set(["queued", "processing", "completed", "error"]);

type TranscriptStatus = "queued" | "processing" | "completed" | "error";

type TranscriptWordPayload = {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
};

type TranscriptUtterancePayload = {
  speaker: string;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWordPayload[];
};

/** Stable poll contract for T08/T09. Do not add fields without updating the handoff. */
type TranscriptPollResponse = {
  id: string;
  status: TranscriptStatus;
  error?: string | null;
  text?: string | null;
  audio_duration?: number | null;
  utterances?: TranscriptUtterancePayload[] | null;
};

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function noStoreJson(body: TranscriptPollResponse, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function redactSecrets(message: string): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (key && message.includes(key)) {
    return message.split(key).join("[redacted]");
  }
  return message;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return redactSecrets(error.message);
  }
  return "Failed to fetch transcript";
}

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("missing assemblyai_api_key") ||
    message.includes("authentication") ||
    message.includes("unauthorized") ||
    message.includes("api token") ||
    message.includes("invalid api key")
  );
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("not found") || /\b404\b/.test(message);
}

function isKnownStatus(value: unknown): value is TranscriptStatus {
  return typeof value === "string" && KNOWN_STATUSES.has(value);
}

function mapWords(
  words: unknown,
): TranscriptWordPayload[] | undefined {
  if (!Array.isArray(words)) {
    return undefined;
  }
  return words.map((word) => {
    const w = word as {
      text?: unknown;
      start?: unknown;
      end?: unknown;
      confidence?: unknown;
      speaker?: unknown;
    };
    const mapped: TranscriptWordPayload = {
      text: typeof w.text === "string" ? w.text : "",
      start: typeof w.start === "number" ? w.start : 0,
      end: typeof w.end === "number" ? w.end : 0,
    };
    if (typeof w.confidence === "number") {
      mapped.confidence = w.confidence;
    }
    if (typeof w.speaker === "string") {
      mapped.speaker = w.speaker;
    }
    return mapped;
  });
}

function mapUtterances(
  utterances: unknown,
): TranscriptUtterancePayload[] | null {
  if (!Array.isArray(utterances)) {
    return null;
  }
  return utterances.map((utterance) => {
    const u = utterance as {
      speaker?: unknown;
      start?: unknown;
      end?: unknown;
      text?: unknown;
      words?: unknown;
    };
    const mapped: TranscriptUtterancePayload = {
      speaker: typeof u.speaker === "string" ? u.speaker : "",
      start: typeof u.start === "number" ? u.start : 0,
      end: typeof u.end === "number" ? u.end : 0,
      text: typeof u.text === "string" ? u.text : "",
    };
    const words = mapWords(u.words);
    if (words) {
      mapped.words = words;
    }
    return mapped;
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const transcriptId = id?.trim() ?? "";
  if (!transcriptId) {
    return jsonError("Missing transcript id.", 400);
  }

  if (!process.env.ASSEMBLYAI_API_KEY) {
    return jsonError(
      "Missing ASSEMBLYAI_API_KEY. Copy .env.example to .env.local and add a key from https://www.assemblyai.com/dashboard/api-keys",
      401,
    );
  }

  try {
    const client = getClient();
    const transcript = await client.transcripts.get(transcriptId);

    if (!transcript.id) {
      return jsonError("AssemblyAI did not return a transcript id.", 500);
    }

    if (!isKnownStatus(transcript.status)) {
      return jsonError("AssemblyAI returned an unexpected transcript status.", 502);
    }

    if (transcript.status === "queued" || transcript.status === "processing") {
      return noStoreJson({
        id: transcript.id,
        status: transcript.status,
      });
    }

    if (transcript.status === "error") {
      return noStoreJson({
        id: transcript.id,
        status: "error",
        error: transcript.error ?? "Transcription failed",
      });
    }

    return noStoreJson({
      id: transcript.id,
      status: "completed",
      text: transcript.text ?? null,
      audio_duration: transcript.audio_duration ?? null,
      utterances: mapUtterances(transcript.utterances),
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error("GET /api/transcripts/[id] failed:", message);
    if (isNotFoundError(error)) {
      return jsonError(message, 404);
    }
    if (isAuthError(error)) {
      return jsonError(message, 401);
    }
    return jsonError(message, 500);
  }
}

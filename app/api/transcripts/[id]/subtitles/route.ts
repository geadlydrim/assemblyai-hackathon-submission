import { getClient } from "@/lib/assemblyai";
import {
  utterancesToSrt,
  utterancesToVtt,
  type SubtitleUtterance,
} from "@/lib/subtitles";

const KNOWN_STATUSES = new Set(["queued", "processing", "completed", "error"]);
const KINDS = new Set(["labelled", "official"]);
const FORMATS = new Set(["srt", "vtt"]);
const DEFAULT_CHARS_PER_CAPTION = 42;

type TranscriptStatus = "queued" | "processing" | "completed" | "error";
type SubtitleKind = "labelled" | "official";
type SubtitleFormat = "srt" | "vtt";

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status });
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
  return "Failed to export subtitles";
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

function isKind(value: string | null): value is SubtitleKind {
  return value !== null && KINDS.has(value);
}

function isFormat(value: string | null): value is SubtitleFormat {
  return value !== null && FORMATS.has(value);
}

function parseCharsPerCaption(raw: string | null): number | Response {
  if (raw === null || raw === "") {
    return DEFAULT_CHARS_PER_CAPTION;
  }
  if (!/^\d+$/.test(raw)) {
    return jsonError(
      "Invalid chars_per_caption. Use a positive integer (default 42).",
      400,
    );
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    return jsonError(
      "Invalid chars_per_caption. Use a positive integer (default 42).",
      400,
    );
  }
  return value;
}

function isUtteranceArray(value: unknown): value is SubtitleUtterance[] {
  return Array.isArray(value);
}

function subtitleResponse(
  body: string,
  id: string,
  kind: SubtitleKind,
  format: SubtitleFormat,
): Response {
  const contentType =
    format === "vtt" ? "text/vtt; charset=utf-8" : "text/plain; charset=utf-8";
  const filename = `transcript-${id}-${kind}.${format}`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const transcriptId = id?.trim() ?? "";
  if (!transcriptId) {
    return jsonError("Missing transcript id.", 400);
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const format = url.searchParams.get("format");

  if (!isKind(kind)) {
    return jsonError('Invalid kind. Use "labelled" or "official".', 400);
  }
  if (!isFormat(format)) {
    return jsonError('Invalid format. Use "srt" or "vtt".', 400);
  }

  const charsPerCaption = parseCharsPerCaption(
    url.searchParams.get("chars_per_caption"),
  );
  if (charsPerCaption instanceof Response) {
    return charsPerCaption;
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

    if (transcript.status === "error") {
      return jsonError(transcript.error ?? "Transcription failed", 502, {
        status: "error",
      });
    }

    if (transcript.status !== "completed") {
      return jsonError("transcript not completed", 409, {
        status: transcript.status,
      });
    }

    if (kind === "labelled") {
      if (!isUtteranceArray(transcript.utterances)) {
        return jsonError(
          "Transcript has no utterances; speaker-labelled subtitles require speaker diarization output.",
          500,
        );
      }
      const body =
        format === "srt"
          ? utterancesToSrt(transcript.utterances)
          : utterancesToVtt(transcript.utterances);
      return subtitleResponse(body, transcript.id, kind, format);
    }

    const body = await client.transcripts.subtitles(
      transcript.id,
      format,
      charsPerCaption,
    );
    return subtitleResponse(body, transcript.id, kind, format);
  } catch (error) {
    const message = errorMessage(error);
    console.error("GET /api/transcripts/[id]/subtitles failed:", message);
    if (isNotFoundError(error)) {
      return jsonError(message, 404);
    }
    if (isAuthError(error)) {
      return jsonError(message, 401);
    }
    return jsonError(message, 500);
  }
}

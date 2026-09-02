import { getClient, TRANSCRIPT_SUBMIT_PARAMS } from "@/lib/assemblyai";

export const maxDuration = 300;

/** Local-dev cap. AssemblyAI allows much larger uploads; we reject earlier. */
const MAX_FILE_BYTES = 150 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "3ga",
  "8svx",
  "aac",
  "ac3",
  "aif",
  "aiff",
  "alac",
  "amr",
  "ape",
  "au",
  "dss",
  "flac",
  "flv",
  "m2ts",
  "m4a",
  "m4b",
  "m4p",
  "m4r",
  "m4v",
  "mov",
  "mp2",
  "mp3",
  "mp4",
  "mpga",
  "mts",
  "mxf",
  "oga",
  "ogg",
  "mogg",
  "opus",
  "qcp",
  "ts",
  "tta",
  "voc",
  "wav",
  "webm",
  "wma",
  "wv",
]);

const OBVIOUSLY_WRONG_MIME = new Set([
  "application/javascript",
  "application/json",
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/xml",
  "application/zip",
  "application/x-zip-compressed",
]);

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).name === "string"
  );
}

function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

function isObviouslyWrongMime(mime: string): boolean {
  if (!mime) {
    return false;
  }
  if (
    mime.startsWith("image/") ||
    mime.startsWith("text/") ||
    mime.startsWith("font/") ||
    mime.startsWith("model/")
  ) {
    return true;
  }
  return OBVIOUSLY_WRONG_MIME.has(mime);
}

function isAllowedMedia(file: File): boolean {
  const mime = (file.type ?? "").toLowerCase().trim();
  if (
    mime.startsWith("audio/") ||
    mime.startsWith("video/") ||
    mime === "application/ogg"
  ) {
    return true;
  }
  if (isObviouslyWrongMime(mime)) {
    return false;
  }
  return ALLOWED_EXTENSIONS.has(extensionOf(file.name));
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
  return "Transcription request failed";
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

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonError(
      'Expected multipart/form-data with a file field named "file".',
      400,
    );
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES
    ) {
      return jsonError("File is too large. Maximum size is 150 MB.", 413);
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not parse multipart form data.", 400);
  }

  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    return jsonError(
      'Missing file. Upload audio or video in the multipart field named "file".',
      400,
    );
  }

  if (file.size === 0) {
    return jsonError("File is empty.", 400);
  }

  if (file.size > MAX_FILE_BYTES) {
    return jsonError("File is too large. Maximum size is 150 MB.", 413);
  }

  if (!isAllowedMedia(file)) {
    return jsonError(
      "Unsupported file type. Upload common audio or video (mp3, wav, m4a, mp4, webm, mov, ogg, flac, …).",
      400,
    );
  }

  if (!process.env.ASSEMBLYAI_API_KEY) {
    return jsonError(
      "Missing ASSEMBLYAI_API_KEY. Copy .env.example to .env.local and add a key from https://www.assemblyai.com/dashboard/api-keys",
      401,
    );
  }

  try {
    const client = getClient();
    const audio = Buffer.from(await file.arrayBuffer());
    const uploadUrl = await client.files.upload(audio);
    const transcript = await client.transcripts.submit({
      audio: uploadUrl,
      ...TRANSCRIPT_SUBMIT_PARAMS,
    });

    if (!transcript.id) {
      return jsonError("AssemblyAI did not return a transcript id.", 500);
    }

    return Response.json({ id: transcript.id });
  } catch (error) {
    const message = errorMessage(error);
    console.error("POST /api/transcribe failed:", message);
    if (isAuthError(error)) {
      return jsonError(message, 401);
    }
    return jsonError(message, 500);
  }
}

"use client";

import { useState, type FormEvent } from "react";

/** Common audio + video types accepted by T03 / AssemblyAI. */
const ACCEPT = [
  "audio/*",
  "video/*",
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".ogg",
  ".oga",
  ".opus",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".aiff",
  ".aif",
  ".wma",
].join(",");

type TranscribeResponse = {
  id?: string;
  error?: string;
};

/**
 * Home-page upload form. Posts `FormData` field `file` to `POST /api/transcribe`.
 *
 * T08: extend this component. Poll `transcriptId` with `GET /api/transcripts/[id]`.
 * Do not rewrite `app/page.tsx`. Do not add polling here in T07.
 */
export function Uploader() {
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setTranscriptId(null);
      setError("Choose an audio or video file to upload.");
      return;
    }

    setIsUploading(true);
    setTranscriptId(null);
    setError(null);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      let data: TranscribeResponse | null = null;
      try {
        data = (await response.json()) as TranscribeResponse;
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(data?.error ?? `Upload failed (${response.status}).`);
        return;
      }

      if (!data?.id) {
        setError("The server did not return a transcript id.");
        return;
      }

      setTranscriptId(data.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 w-full max-w-md">
      <label className="block text-sm font-medium" htmlFor="file">
        Audio or video
      </label>
      <input
        id="file"
        name="file"
        type="file"
        accept={ACCEPT}
        disabled={isUploading}
        required
        className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-zinc-800"
      />

      <button
        type="submit"
        disabled={isUploading}
        className="mt-4 w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {isUploading ? "Uploading…" : "Generate subtitles"}
      </button>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {transcriptId ? (
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
          Transcript id:{" "}
          <code className="break-all font-mono text-xs">{transcriptId}</code>
        </p>
      ) : null}
    </form>
  );
}

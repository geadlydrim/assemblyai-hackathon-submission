"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { JobStatus, type TranscriptPollResponse } from "@/components/JobStatus";
import { MediaPreview } from "@/components/MediaPreview";

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
 * Home-page upload form. Posts `FormData` field `file` to `POST /api/transcribe`,
 * then mounts `JobStatus` to poll T04.
 *
 * Keeps the picked `File` for `MediaPreview` (object URL + labelled VTT track).
 * Do not rewrite `app/page.tsx`. No download buttons here (T10).
 */
export function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPollResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    const picked = next && next.size > 0 ? next : null;
    setFile(picked);
    setTranscriptId(null);
    setTranscript(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const uploaded = formData.get("file");

    if (!(uploaded instanceof File) || uploaded.size === 0) {
      setFile(null);
      setTranscriptId(null);
      setTranscript(null);
      setError("Choose an audio or video file to upload.");
      return;
    }

    setFile(uploaded);
    setIsUploading(true);
    setTranscriptId(null);
    setTranscript(null);
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
    <div className="mt-10 w-full max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md"
        aria-busy={
          isUploading ||
          (transcriptId !== null &&
            transcript?.status !== "completed" &&
            transcript?.status !== "error")
        }
      >
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
          onChange={handleFileChange}
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
          <>
            <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
              Transcript id:{" "}
              <code className="break-all font-mono text-xs">{transcriptId}</code>
            </p>
            <JobStatus
              key={transcriptId}
              transcriptId={transcriptId}
              onTranscript={setTranscript}
            />
          </>
        ) : null}
      </form>

      {file ? (
        <MediaPreview
          key={`${file.name}:${file.size}:${file.lastModified}`}
          file={file}
          transcriptId={transcriptId}
          status={transcript?.status ?? null}
          utterances={transcript?.utterances ?? null}
        />
      ) : null}
    </div>
  );
}

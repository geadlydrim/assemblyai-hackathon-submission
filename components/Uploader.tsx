"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { DownloadBar } from "@/components/DownloadBar";
import { JobStatus, type TranscriptPollResponse } from "@/components/JobStatus";
import { MediaPreview } from "@/components/MediaPreview";
import {
  emptyStateCopy,
  formatUploadError,
  uploadingCopy,
} from "@/lib/downloads";

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
 * `DownloadBar` is always visible and stays disabled until status is completed.
 */
export function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPollResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function resetJob() {
    setTranscriptId(null);
    setTranscript(null);
    setError(null);
    setSubtitleError(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    const picked = next && next.size > 0 ? next : null;
    setFile(picked);
    resetJob();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const uploaded = formData.get("file");

    if (!(uploaded instanceof File) || uploaded.size === 0) {
      setFile(null);
      resetJob();
      setError("Choose an audio or video file to upload.");
      return;
    }

    setFile(uploaded);
    setIsUploading(true);
    resetJob();

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
        setError(
          formatUploadError(data?.error ?? `Upload failed (${response.status}).`),
        );
        return;
      }

      if (!data?.id) {
        setError(formatUploadError("The server did not return a transcript id."));
        return;
      }

      setTranscriptId(data.id);
    } catch (caught) {
      setError(
        formatUploadError(
          caught instanceof Error ? caught.message : "Upload failed.",
        ),
      );
    } finally {
      setIsUploading(false);
    }
  }

  const showEmptyState = !file && !isUploading && !transcriptId;

  return (
    <div className="mt-8 w-full">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        aria-busy={
          isUploading ||
          (transcriptId !== null &&
            transcript?.status !== "completed" &&
            transcript?.status !== "error")
        }
      >
        <label
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          htmlFor="file"
        >
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
          className="mt-2 block w-full text-sm text-zinc-800 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-900 dark:text-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100"
        />

        <button
          type="submit"
          disabled={isUploading}
          className="mt-4 w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isUploading ? "Uploading…" : "Generate subtitles"}
        </button>

        {showEmptyState ? (
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
            {emptyStateCopy()}
          </p>
        ) : null}

        {file ? (
          <p className="mt-4 text-sm text-zinc-800 dark:text-zinc-200">
            Selected: <span className="font-medium">{file.name}</span>
          </p>
        ) : null}

        {isUploading ? (
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
            {uploadingCopy()}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-700 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {transcriptId ? (
          <>
            <p className="mt-4 text-sm text-zinc-800 dark:text-zinc-200">
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

        <DownloadBar
          transcriptId={transcriptId}
          status={transcript?.status ?? null}
          subtitleError={subtitleError}
        />
      </form>

      {file ? (
        <MediaPreview
          key={`${file.name}:${file.size}:${file.lastModified}`}
          file={file}
          transcriptId={transcriptId}
          status={transcript?.status ?? null}
          utterances={transcript?.utterances ?? null}
          onSubtitleError={setSubtitleError}
        />
      ) : null}
    </div>
  );
}

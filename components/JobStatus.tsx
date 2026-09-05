"use client";

import { useEffect, useState } from "react";

import {
  POLL_INTERVAL_MS,
  resolvePollResponse,
  shouldStartPolling,
  type TranscriptPollResponse,
  type TranscriptStatus,
  type TranscriptUtterance,
} from "@/lib/poll-transcript";

export type {
  TranscriptPollResponse,
  TranscriptStatus,
  TranscriptUtterance,
  TranscriptWord,
} from "@/lib/poll-transcript";

type JobStatusProps = {
  transcriptId: string;
  /** Lifted completed/in-progress poll payload for T09. */
  onTranscript?: (transcript: TranscriptPollResponse | null) => void;
};

function statusClassName(status: TranscriptStatus | null): string {
  if (status === "completed") {
    return "text-emerald-700 dark:text-emerald-400";
  }
  if (status === "error") {
    return "text-red-600 dark:text-red-400";
  }
  return "text-zinc-800 dark:text-zinc-200";
}

/**
 * Polls `GET /api/transcripts/{id}` every 3s until completed or error.
 * T09: completed `text` / `utterances` live in this component's state and are
 * also lifted to `Uploader` via `onTranscript`.
 */
export function JobStatus({ transcriptId, onTranscript }: JobStatusProps) {
  const [status, setStatus] = useState<TranscriptStatus | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [utterances, setUtterances] = useState<TranscriptUtterance[] | null>(
    null,
  );
  const [jobError, setJobError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldStartPolling(transcriptId)) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const applyInProgress = (transcript: TranscriptPollResponse) => {
      setStatus(transcript.status);
      setPollError(null);
      onTranscript?.(transcript);
    };

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }
      timeoutId = setTimeout(() => {
        void poll();
      }, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      if (cancelled) {
        return;
      }

      try {
        const response = await fetch(
          `/api/transcripts/${encodeURIComponent(transcriptId.trim())}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }

        if (cancelled) {
          return;
        }

        const outcome = resolvePollResponse(response.status, body);

        switch (outcome.kind) {
          case "in_progress":
            applyInProgress(outcome.transcript);
            scheduleNext();
            break;
          case "completed":
            setStatus("completed");
            setText(outcome.transcript.text ?? "");
            setUtterances(outcome.transcript.utterances ?? null);
            setJobError(null);
            setPollError(null);
            onTranscript?.(outcome.transcript);
            break;
          case "job_error":
            setStatus("error");
            setJobError(outcome.transcript.error ?? "Transcription failed");
            setPollError(null);
            onTranscript?.(outcome.transcript);
            break;
          case "fatal":
            setPollError(outcome.message);
            break;
          case "transient":
            setPollError(outcome.message);
            scheduleNext();
            break;
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        if (caught instanceof Error && caught.name === "AbortError") {
          return;
        }
        setPollError(
          caught instanceof Error ? caught.message : "Polling failed.",
        );
        scheduleNext();
      }
    };

    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [transcriptId, onTranscript]);

  const shownStatus = status ?? (pollError ? null : "queued");
  const transcriptBody = text?.trim() ? text : "(empty transcript)";

  return (
    <section className="mt-6" aria-live="polite">
      {shownStatus ? (
        <p className="text-sm">
          Status:{" "}
          <span className={`font-medium ${statusClassName(status)}`}>
            {shownStatus}
          </span>
        </p>
      ) : null}

      {status === "queued" || status === "processing" || status === null ? (
        pollError ? null : (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Transcribing… polling every 3 seconds.
          </p>
        )
      ) : null}

      {jobError ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {jobError}
        </p>
      ) : null}

      {pollError && status !== "completed" && status !== "error" ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {pollError}
        </p>
      ) : null}

      {status === "completed" ? (
        <details className="mt-4" open>
          <summary className="cursor-pointer text-sm font-medium">
            Transcript
            {utterances?.length
              ? ` · ${utterances.length} utterance${utterances.length === 1 ? "" : "s"}`
              : ""}
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-100 p-3 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
            {transcriptBody}
          </pre>
        </details>
      ) : null}
    </section>
  );
}

"use client";

import {
  SUBTITLE_DOWNLOADS,
  downloadsEnabled,
  subtitleDownloadFilename,
  subtitleDownloadHref,
} from "@/lib/downloads";
import type { TranscriptStatus } from "@/lib/poll-transcript";

type DownloadBarProps = {
  transcriptId: string | null;
  status: TranscriptStatus | null | undefined;
  subtitleError: string | null;
};

/**
 * Four T06 download links. Enabled only after the job is `completed`.
 * Labelled = Speaker A/B/C. Official = AssemblyAI export, no names.
 */
export function DownloadBar({
  transcriptId,
  status,
  subtitleError,
}: DownloadBarProps) {
  const enabled = Boolean(transcriptId) && downloadsEnabled(status);
  const blockedBySubtitles = enabled && Boolean(subtitleError);

  return (
    <section className="mt-8" aria-label="Subtitle downloads">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Downloads
      </h2>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
        Labelled files prefix cues with Speaker A/B/C. Official files are
        AssemblyAI&apos;s plain export (no speaker names).
      </p>

      {!enabled ? (
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          Downloads unlock when transcription completes.
        </p>
      ) : null}

      {subtitleError ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-400" role="alert">
          {subtitleError}
        </p>
      ) : null}

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SUBTITLE_DOWNLOADS.map((item) => {
          const href = transcriptId
            ? subtitleDownloadHref(transcriptId, item.kind, item.format)
            : "#";
          const filename = transcriptId
            ? subtitleDownloadFilename(transcriptId, item.kind, item.format)
            : `${item.kind}.${item.format}`;
          const clickable = enabled && !blockedBySubtitles;

          return (
            <li key={`${item.kind}-${item.format}`}>
              {clickable ? (
                <a
                  href={href}
                  download={filename}
                  className="block rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
                >
                  <span className="block">{item.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-zinc-600 dark:text-zinc-400">
                    {filename}
                  </span>
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="block cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-600"
                >
                  <span className="block">{item.label}</span>
                  {transcriptId ? (
                    <span className="mt-0.5 block text-xs font-normal">
                      {filename}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-xs font-normal">
                      {item.description}
                    </span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

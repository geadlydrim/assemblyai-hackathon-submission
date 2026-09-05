"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";

import {
  activeCueIndex,
  cuesFromUtterances,
  formatCueClock,
  isVideoFile,
  labelledVttSrc,
  parseVttCues,
  type PreviewCue,
} from "@/lib/media-preview";
import type {
  TranscriptStatus,
  TranscriptUtterance,
} from "@/lib/poll-transcript";

type MediaPreviewProps = {
  file: File;
  transcriptId: string | null;
  status: TranscriptStatus | null | undefined;
  utterances: TranscriptUtterance[] | null | undefined;
};

/**
 * Local object-URL preview. Video gets labelled VTT as `<track default>`.
 * Audio always shows an on-page cue list. Video falls back to that list
 * if the browser does not attach the remote track.
 *
 * Parent should remount this component when `file` changes (see `key` in
 * `Uploader`) so the object URL is created once and revoked on unmount.
 */
export function MediaPreview({
  file,
  transcriptId,
  status,
  utterances,
}: MediaPreviewProps) {
  const video = isVideoFile(file);
  const vttSrc =
    status === "completed" && transcriptId
      ? labelledVttSrc(transcriptId)
      : null;

  const [objectUrl] = useState(() => URL.createObjectURL(file));
  const [fetchedCues, setFetchedCues] = useState<PreviewCue[] | null>(null);
  const [trackFailed, setTrackFailed] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const trackRef = useRef<HTMLTrackElement | null>(null);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!vttSrc) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadCues = async () => {
      try {
        const response = await fetch(vttSrc, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.text();
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setFetchedCues(cuesFromUtterances(utterances));
          return;
        }
        const parsed = parseVttCues(body);
        setFetchedCues(
          parsed.length > 0 ? parsed : cuesFromUtterances(utterances),
        );
      } catch (caught) {
        if (cancelled) {
          return;
        }
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setFetchedCues(cuesFromUtterances(utterances));
      }
    };

    void loadCues();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [vttSrc, utterances]);

  useEffect(() => {
    if (!video || !vttSrc) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const cueCount = trackRef.current?.track.cues?.length ?? 0;
      if (cueCount === 0) {
        setTrackFailed(true);
      }
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [video, vttSrc]);

  function handleTimeUpdate(event: SyntheticEvent<HTMLMediaElement>) {
    setCurrentTimeMs(event.currentTarget.currentTime * 1000);
  }

  function handleTrackLoad(event: SyntheticEvent<HTMLTrackElement>) {
    const cueCount = event.currentTarget.track.cues?.length ?? 0;
    if (cueCount === 0) {
      setTrackFailed(true);
    }
  }

  const cues = fetchedCues ?? cuesFromUtterances(utterances);
  const showCueList = !video || trackFailed;
  const active = showCueList ? activeCueIndex(cues, currentTimeMs) : -1;

  return (
    <section className="mt-8 w-full" aria-label="Media preview">
      {video ? (
        <video
          controls
          playsInline
          src={objectUrl}
          className="w-full rounded-md bg-black"
          onTimeUpdate={handleTimeUpdate}
        >
          {vttSrc ? (
            <track
              ref={trackRef}
              kind="subtitles"
              src={vttSrc}
              default
              label="English"
              srcLang="en"
              onError={() => {
                setTrackFailed(true);
              }}
              onLoad={handleTrackLoad}
            />
          ) : null}
        </video>
      ) : (
        <audio
          controls
          src={objectUrl}
          className="w-full"
          onTimeUpdate={handleTimeUpdate}
        />
      )}

      {vttSrc && video && !trackFailed ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Captions: labelled English track (enable CC in the player if they are
          hidden).
        </p>
      ) : null}

      {showCueList ? (
        <CueList cues={cues} activeIndex={active} waiting={Boolean(vttSrc)} />
      ) : null}
    </section>
  );
}

function CueList({
  cues,
  activeIndex,
  waiting,
}: {
  cues: PreviewCue[];
  activeIndex: number;
  waiting: boolean;
}) {
  return (
    <div className="mt-4">
      <h2 className="text-sm font-medium">Captions</h2>
      {cues.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {waiting
            ? "Waiting for labelled captions…"
            : "Captions appear here after transcription completes."}
        </p>
      ) : (
        <ol className="mt-2 max-h-64 list-none space-y-2 overflow-auto rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
          {cues.map((cue, index) => (
            <li
              key={`${cue.startMs}-${cue.endMs}-${index}`}
              className={
                index === activeIndex
                  ? "rounded-sm bg-zinc-200 px-2 py-1 dark:bg-zinc-800"
                  : "px-2 py-1"
              }
            >
              <span className="mr-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {formatCueClock(cue.startMs)}
              </span>
              <span>{cue.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

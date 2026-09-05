import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SUBTITLE_DOWNLOADS,
  downloadsEnabled,
  emptyStateCopy,
  formatSubtitleError,
  formatTranscriptionError,
  formatUploadError,
  processingCopy,
  queuedCopy,
  subtitleDownloadFilename,
  subtitleDownloadHref,
  uploadingCopy,
} from "./downloads";

describe("subtitle download URLs", () => {
  const id = "bfb050cf-348d-4f0c-8e1b-e4670cc24f95";

  it("builds the four T06 download paths", () => {
    assert.equal(
      subtitleDownloadHref(id, "labelled", "srt"),
      `/api/transcripts/${id}/subtitles?kind=labelled&format=srt`,
    );
    assert.equal(
      subtitleDownloadHref(id, "labelled", "vtt"),
      `/api/transcripts/${id}/subtitles?kind=labelled&format=vtt`,
    );
    assert.equal(
      subtitleDownloadHref(id, "official", "srt"),
      `/api/transcripts/${id}/subtitles?kind=official&format=srt`,
    );
    assert.equal(
      subtitleDownloadHref(id, "official", "vtt"),
      `/api/transcripts/${id}/subtitles?kind=official&format=vtt`,
    );
  });

  it("encodes the transcript id and matches T06 filenames", () => {
    assert.equal(
      subtitleDownloadHref("id with space", "labelled", "srt"),
      "/api/transcripts/id%20with%20space/subtitles?kind=labelled&format=srt",
    );
    assert.equal(
      subtitleDownloadFilename(id, "labelled", "srt"),
      `transcript-${id}-labelled.srt`,
    );
    assert.equal(
      subtitleDownloadFilename(id, "official", "vtt"),
      `transcript-${id}-official.vtt`,
    );
  });

  it("lists labelled then official, SRT then VTT", () => {
    assert.deepEqual(
      SUBTITLE_DOWNLOADS.map((item) => `${item.kind}.${item.format}`),
      ["labelled.srt", "labelled.vtt", "official.srt", "official.vtt"],
    );
  });
});

describe("download availability", () => {
  it("enables downloads only when the job is completed", () => {
    assert.equal(downloadsEnabled("completed"), true);
    assert.equal(downloadsEnabled("queued"), false);
    assert.equal(downloadsEnabled("processing"), false);
    assert.equal(downloadsEnabled("error"), false);
    assert.equal(downloadsEnabled(null), false);
    assert.equal(downloadsEnabled(undefined), false);
  });
});

describe("status and error copy", () => {
  it("keeps empty / uploading / queued / processing distinct", () => {
    assert.match(emptyStateCopy(), /no file chosen/i);
    assert.match(uploadingCopy(), /uploading/i);
    assert.match(queuedCopy(), /queued/i);
    assert.match(processingCopy(), /processing/i);
    assert.notEqual(queuedCopy(), processingCopy());
    assert.notEqual(uploadingCopy(), queuedCopy());
  });

  it("prefixes upload vs transcription vs subtitle failures", () => {
    assert.equal(formatUploadError("File is empty."), "Upload failed: File is empty.");
    assert.equal(formatUploadError("Upload failed (400)."), "Upload failed (400).");
    assert.equal(
      formatTranscriptionError("Audio is too short."),
      "Transcription failed: Audio is too short.",
    );
    assert.equal(
      formatTranscriptionError("Transcription failed"),
      "Transcription failed",
    );
    assert.equal(
      formatSubtitleError(500, '{"error":"Transcript has no utterances; speaker-labelled subtitles require speaker diarization output."}'),
      "Subtitles failed: this recording looks empty or silent, so no captions could be generated.",
    );
    assert.equal(
      formatSubtitleError(500, "Unable to create captions. Transcript text is empty."),
      "Subtitles failed: this recording looks empty or silent, so no captions could be generated.",
    );
    assert.equal(
      formatSubtitleError(502, '{"error":"export exploded"}'),
      "Subtitles failed: export exploded",
    );
  });
});

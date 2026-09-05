import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { utterancesToVtt } from "./subtitles";
import {
  activeCueIndex,
  cuesFromUtterances,
  formatCueClock,
  isVideoFile,
  labelledVttSrc,
  parseVttCues,
  parseVttTimestamp,
} from "./media-preview";

describe("labelledVttSrc", () => {
  it("builds the T06 labelled VTT path and encodes the id", () => {
    assert.equal(
      labelledVttSrc("bfb050cf-348d-4f0c-8e1b-e4670cc24f95"),
      "/api/transcripts/bfb050cf-348d-4f0c-8e1b-e4670cc24f95/subtitles?kind=labelled&format=vtt",
    );
    assert.equal(
      labelledVttSrc("id with space"),
      "/api/transcripts/id%20with%20space/subtitles?kind=labelled&format=vtt",
    );
    assert.ok(!labelledVttSrc("abc").includes("official"));
  });
});

describe("isVideoFile", () => {
  it("treats video/* as video and audio/* as audio", () => {
    assert.equal(isVideoFile({ type: "video/mp4", name: "clip.bin" }), true);
    assert.equal(isVideoFile({ type: "audio/wav", name: "clip.mp4" }), false);
  });

  it("falls back to extension when MIME is empty or generic", () => {
    assert.equal(isVideoFile({ type: "", name: "talk.webm" }), true);
    assert.equal(isVideoFile({ type: "application/octet-stream", name: "talk.mov" }), true);
    assert.equal(isVideoFile({ type: "", name: "talk.wav" }), false);
  });
});

describe("parseVttCues", () => {
  it("parses T05 labelled VTT including speaker prefixes", () => {
    const vtt = utterancesToVtt([
      {
        speaker: "A",
        start: 0,
        end: 1842,
        text: "Hello, my name is Alex.",
        words: [
          { text: "Hello,", start: 0, end: 456 },
          { text: "my", start: 766, end: 863 },
          { text: "name", start: 1010, end: 1271 },
          { text: "is", start: 1271, end: 1483 },
          { text: "Alex.", start: 1483, end: 1842 },
        ],
      },
    ]);

    const cues = parseVttCues(vtt);
    assert.equal(cues.length, 1);
    assert.equal(cues[0].startMs, 0);
    assert.equal(cues[0].endMs, 1842);
    assert.equal(cues[0].text, "Speaker A: Hello, my name is Alex.");
  });

  it("skips cue identifiers and empty documents", () => {
    assert.deepEqual(parseVttCues("WEBVTT\n\n"), []);
    const cues = parseVttCues(
      [
        "WEBVTT",
        "",
        "1",
        "00:00:00.000 --> 00:00:01.000",
        "Speaker B: Hi",
        "",
      ].join("\n"),
    );
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, "Speaker B: Hi");
    assert.equal(cues[0].endMs, 1000);
  });
});

describe("cuesFromUtterances / clocks", () => {
  it("prefixes Speaker A and ignores empty text", () => {
    const cues = cuesFromUtterances([
      { speaker: "A", start: 0, end: 900, text: "Hello" },
      { speaker: "B", start: 1000, end: 1500, text: "   " },
    ]);
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, "Speaker A: Hello");
    assert.deepEqual(cuesFromUtterances(null), []);
  });

  it("round-trips VTT clocks and finds the active cue", () => {
    assert.equal(formatCueClock(1842), "00:00:01.842");
    assert.equal(parseVttTimestamp("00:00:01.842"), 1842);
    const cues = [
      { startMs: 0, endMs: 1000, text: "a" },
      { startMs: 1000, endMs: 2000, text: "b" },
    ];
    assert.equal(activeCueIndex(cues, 0), 0);
    assert.equal(activeCueIndex(cues, 1000), 1);
    assert.equal(activeCueIndex(cues, 1999), 1);
    assert.equal(activeCueIndex(cues, 2000), -1);
  });
});

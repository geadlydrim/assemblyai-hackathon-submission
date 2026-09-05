import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_MAX_CHARS_PER_CUE,
  DEFAULT_MAX_WORDS_PER_CUE,
  EMPTY_VTT,
  formatSpeakerLabel,
  utterancesToSrt,
  utterancesToVtt,
  type SubtitleUtterance,
  type SubtitleWord,
} from "./subtitles";

function word(
  text: string,
  start: number,
  end: number,
  speaker = "A",
): SubtitleWord {
  return { text, start, end, speaker, confidence: 0.99 };
}

/** T04 spoken-sample utterance (9 words, 42-character body). */
const T04_WORDS: SubtitleWord[] = [
  word("Hello,", 0, 456),
  word("my", 766, 863),
  word("name", 1010, 1271),
  word("is", 1271, 1483),
  word("Alex.", 1483, 1842),
  word("How", 2396, 2591),
  word("are", 2706, 2787),
  word("you", 2787, 2836),
  word("today?", 2950, 3227),
];

const shortOneSpeaker: SubtitleUtterance = {
  speaker: "A",
  start: 0,
  end: 1842,
  text: "Hello, my name is Alex.",
  words: T04_WORDS.slice(0, 5),
};

describe("utterancesToSrt / utterancesToVtt", () => {
  it("returns empty SRT and a valid empty VTT for empty input", () => {
    assert.equal(utterancesToSrt([]), "");
    assert.equal(utterancesToSrt(null), "");
    assert.equal(utterancesToSrt(undefined), "");
    assert.equal(utterancesToVtt([]), EMPTY_VTT);
    assert.equal(utterancesToVtt(null), "WEBVTT\n\n");
    assert.equal(utterancesToVtt(undefined), "WEBVTT\n\n");
  });

  it("emits one speaker-labelled cue for a short single-speaker utterance", () => {
    const srt = utterancesToSrt([shortOneSpeaker]);
    assert.equal(
      srt,
      [
        "1",
        "00:00:00,000 --> 00:00:01,842",
        "Speaker A: Hello, my name is Alex.",
        "",
      ].join("\n"),
    );

    const vtt = utterancesToVtt([shortOneSpeaker]);
    assert.equal(
      vtt,
      [
        "WEBVTT",
        "",
        "00:00:00.000 --> 00:00:01.842",
        "Speaker A: Hello, my name is Alex.",
        "",
      ].join("\n"),
    );
  });

  it("starts VTT with WEBVTT and a blank line", () => {
    const vtt = utterancesToVtt([shortOneSpeaker]);
    assert.ok(vtt.startsWith("WEBVTT\n\n"));
    assert.equal(vtt.slice(0, 8), "WEBVTT\n\n");
    assert.match(vtt, /^WEBVTT\n\n\d{2}:\d{2}:\d{2}\.\d{3} --> /);
  });

  it("starts a new cue when the speaker changes", () => {
    const utterances: SubtitleUtterance[] = [
      {
        speaker: "A",
        start: 0,
        end: 900,
        text: "Hello there.",
        words: [word("Hello", 0, 400), word("there.", 450, 900)],
      },
      {
        speaker: "B",
        start: 1000,
        end: 1800,
        text: "Hi Alex.",
        words: [word("Hi", 1000, 1300, "B"), word("Alex.", 1400, 1800, "B")],
      },
    ];

    const srt = utterancesToSrt(utterances);
    assert.equal(
      srt,
      [
        "1",
        "00:00:00,000 --> 00:00:00,900",
        "Speaker A: Hello there.",
        "",
        "2",
        "00:00:01,000 --> 00:00:01,800",
        "Speaker B: Hi Alex.",
        "",
      ].join("\n"),
    );

    const vtt = utterancesToVtt(utterances);
    assert.match(vtt, /Speaker A: Hello there\./);
    assert.match(vtt, /Speaker B: Hi Alex\./);
    assert.ok(!vtt.includes("<font"));
    assert.ok(!srt.includes("<font"));
  });

  it("splits a long utterance on the 8-word default before 42 characters", () => {
    const longUtterance: SubtitleUtterance = {
      speaker: "A",
      start: 0,
      end: 3227,
      text: "Hello, my name is Alex. How are you today?",
      words: T04_WORDS,
    };

    assert.equal(DEFAULT_MAX_WORDS_PER_CUE, 8);
    assert.equal(DEFAULT_MAX_CHARS_PER_CUE, 42);

    const srt = utterancesToSrt([longUtterance]);
    assert.equal(
      srt,
      [
        "1",
        "00:00:00,000 --> 00:00:02,836",
        "Speaker A: Hello, my name is Alex. How are you",
        "",
        "2",
        "00:00:02,950 --> 00:00:03,227",
        "Speaker A: today?",
        "",
      ].join("\n"),
    );

    const vtt = utterancesToVtt([longUtterance]);
    assert.ok(vtt.startsWith("WEBVTT\n\n"));
    assert.match(vtt, /00:00:00\.000 --> 00:00:02\.836/);
    assert.match(vtt, /Speaker A: Hello, my name is Alex\. How are you/);
    assert.match(vtt, /00:00:02\.950 --> 00:00:03\.227/);
    assert.match(vtt, /Speaker A: today\?/);
  });

  it("splits on character limit when it fires before the word limit", () => {
    const utterances: SubtitleUtterance[] = [
      {
        speaker: "A",
        start: 0,
        end: 4000,
        text: "Extraordinary circumstances require extraordinary measures today",
        words: [
          word("Extraordinary", 0, 800),
          word("circumstances", 900, 1800),
          word("require", 1900, 2500),
          word("extraordinary", 2600, 3400),
          word("measures", 3500, 3800),
          word("today", 3850, 4000),
        ],
      },
    ];

    const srt = utterancesToSrt(utterances);
    assert.equal(
      srt,
      [
        "1",
        "00:00:00,000 --> 00:00:02,500",
        "Speaker A: Extraordinary circumstances require",
        "",
        "2",
        "00:00:02,600 --> 00:00:04,000",
        "Speaker A: extraordinary measures today",
        "",
      ].join("\n"),
    );
    assert.ok(
      "Extraordinary circumstances require".length <= DEFAULT_MAX_CHARS_PER_CUE,
    );
    assert.ok(
      "Extraordinary circumstances require extraordinary".length >
        DEFAULT_MAX_CHARS_PER_CUE,
    );
  });

  it("never splits a single word even when it exceeds maxCharsPerCue", () => {
    const monster = "supercalifragilisticexpialidocious-and-then-some";
    assert.ok(monster.length > DEFAULT_MAX_CHARS_PER_CUE);

    const srt = utterancesToSrt([
      {
        speaker: "A",
        start: 10,
        end: 90,
        text: monster,
        words: [word(monster, 10, 90)],
      },
    ]);

    assert.equal(
      srt,
      `1\n00:00:00,010 --> 00:00:00,090\nSpeaker A: ${monster}\n`,
    );
    assert.equal((srt.match(/^1\n/gm) ?? []).length, 1);
  });

  it("emits one cue from utterance start/end when words are missing", () => {
    const utterance: SubtitleUtterance = {
      speaker: "B",
      start: 1500,
      end: 4200,
      text: "No word timestamps on this turn at all.",
    };

    const srt = utterancesToSrt([utterance]);
    assert.equal(
      srt,
      [
        "1",
        "00:00:01,500 --> 00:00:04,200",
        "Speaker B: No word timestamps on this turn at all.",
        "",
      ].join("\n"),
    );
  });

  it("honors option overrides and prefixes bare speaker letters", () => {
    assert.equal(formatSpeakerLabel("A"), "Speaker A");
    assert.equal(formatSpeakerLabel("Speaker B"), "Speaker B");
    assert.equal(formatSpeakerLabel("speaker C"), "Speaker C");

    const srt = utterancesToSrt(
      [
        {
          speaker: "A",
          start: 0,
          end: 3000,
          text: "one two three four",
          words: [
            word("one", 0, 500),
            word("two", 600, 1000),
            word("three", 1100, 2000),
            word("four", 2100, 3000),
          ],
        },
      ],
      { maxWordsPerCue: 2, maxCharsPerCue: 200 },
    );

    assert.equal(
      srt,
      [
        "1",
        "00:00:00,000 --> 00:00:01,000",
        "Speaker A: one two",
        "",
        "2",
        "00:00:01,100 --> 00:00:03,000",
        "Speaker A: three four",
        "",
      ].join("\n"),
    );
  });
});

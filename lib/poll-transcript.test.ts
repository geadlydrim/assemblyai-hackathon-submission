import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePollResponse,
  shouldStartPolling,
} from "./poll-transcript";

describe("shouldStartPolling", () => {
  it("does not start without an id", () => {
    assert.equal(shouldStartPolling(null), false);
    assert.equal(shouldStartPolling(undefined), false);
    assert.equal(shouldStartPolling(""), false);
    assert.equal(shouldStartPolling("   "), false);
  });

  it("starts when an id is present", () => {
    assert.equal(shouldStartPolling("bfb050cf-348d-4f0c-8e1b-e4670cc24f95"), true);
  });
});

describe("resolvePollResponse", () => {
  it("stops on missing-key / unknown-id HTTP errors", () => {
    const unauthorized = resolvePollResponse(401, {
      error: "Missing ASSEMBLYAI_API_KEY.",
    });
    assert.equal(unauthorized.kind, "fatal");
    if (unauthorized.kind === "fatal") {
      assert.match(unauthorized.message, /ASSEMBLYAI_API_KEY/);
    }

    const missing = resolvePollResponse(400, { error: "Missing transcript id." });
    assert.equal(missing.kind, "fatal");

    const unknown = resolvePollResponse(404, {
      error: "Transcript lookup error, transcript id not found",
    });
    assert.equal(unknown.kind, "fatal");
  });

  it("stops on completed and job error", () => {
    const completed = resolvePollResponse(200, {
      id: "abc",
      status: "completed",
      text: "Hello",
      utterances: [],
    });
    assert.equal(completed.kind, "completed");

    const failed = resolvePollResponse(200, {
      id: "abc",
      status: "error",
      error: "Audio was too short",
    });
    assert.equal(failed.kind, "job_error");
    if (failed.kind === "job_error") {
      assert.equal(failed.transcript.error, "Audio was too short");
    }
  });

  it("keeps polling while queued or processing, and on 5xx", () => {
    assert.equal(
      resolvePollResponse(200, { id: "abc", status: "queued" }).kind,
      "in_progress",
    );
    assert.equal(
      resolvePollResponse(200, { id: "abc", status: "processing" }).kind,
      "in_progress",
    );
    assert.equal(
      resolvePollResponse(500, { error: "upstream" }).kind,
      "transient",
    );
  });
});

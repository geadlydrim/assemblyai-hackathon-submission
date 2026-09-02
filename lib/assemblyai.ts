import "server-only";

import { AssemblyAI, type TranscriptOptionalParams } from "assemblyai";

/**
 * Locked pre-recorded submit params for every transcripts.submit() call.
 * speech_models is an ordered fallback list (not parallel). Do not use
 * the deprecated singular speech_model field on pre-recorded requests.
 */
export const TRANSCRIPT_SUBMIT_PARAMS: TranscriptOptionalParams = {
  speech_models: ["universal-3-5-pro", "universal-2"],
  speaker_labels: true,
  language_code: "en",
};

let client: AssemblyAI | undefined;

export function getClient(): AssemblyAI {
  if (client) {
    return client;
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ASSEMBLYAI_API_KEY. Copy .env.example to .env.local and add a key from https://www.assemblyai.com/dashboard/api-keys",
    );
  }

  client = new AssemblyAI({ apiKey });
  return client;
}

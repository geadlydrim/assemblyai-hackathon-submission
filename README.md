# Subtitle Generator

A Next.js web app that turns English audio or video into timed subtitles using [AssemblyAI](https://www.assemblyai.com/) speech-to-text.

Upload a local file, wait for transcription, preview captions on the media, and download **SRT** and **VTT**.

## What it does

1. You upload an audio or video file from disk (mp3, wav, mp4, webm, mov, and similar).
2. The server sends it to AssemblyAI. Video does not need a separate audio-extract step — the API pulls the soundtrack itself.
3. Universal-3.5 Pro transcribes the file in English with **speaker diarization** (Speaker A, B, C — not real names).
4. You get:
   - In-browser preview with captions
   - **Speaker-labelled** SRT/VTT (`Speaker A: …`)
   - Optional **plain** SRT/VTT from AssemblyAI’s official subtitle export

Live (realtime) captions are a later phase. This repo is the **pre-recorded** product first.

## Stack

- **Next.js** (App Router, TypeScript)
- Official **`assemblyai`** Node SDK on the server
- API key stays in `.env.local` — never in the browser

## Setup

1. Create an API key at [assemblyai.com/dashboard/api-keys](https://www.assemblyai.com/dashboard/api-keys).
2. Copy `.env.example` to `.env.local` and set `ASSEMBLYAI_API_KEY`.
3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- Transcription runs in AssemblyAI’s **US** region.
- Speaker labels are anonymous (A/B/C). Matching a voice to a person is not supported.
- Large files are submitted as a job and polled until complete, so a long video does not have to sit on one HTTP request.

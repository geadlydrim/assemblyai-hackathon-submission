# Subtitle Generator

Web app that turns uploaded **English** audio or video into speaker-labelled subtitles (SRT and VTT) using [AssemblyAI](https://www.assemblyai.com/) pre-recorded speech-to-text.

Speakers are labelled **A / B / C**, not real names. **Live captions are not in this phase** — this app is upload → wait → preview → download only.

Requires **Node.js 20**.

## Get an API key

1. Create an AssemblyAI account and open [API keys](https://www.assemblyai.com/dashboard/api-keys).
2. Copy a US-region key. Do not put it in client code or commit it.

## Configure `.env.local`

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
ASSEMBLYAI_API_KEY=your_key_here
```

`.env.local` is gitignored. The key is read only on the server.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Choose an English audio or video file, generate subtitles, wait until the job is **completed**, then preview captions and download:

- Labelled SRT / labelled VTT (`Speaker A: …`)
- Official SRT / official VTT (AssemblyAI export, no speaker names)

## Supported file types

Common audio and video that AssemblyAI accepts, including:

- Audio: `mp3`, `wav`, `m4a`, `aac`, `flac`, `ogg`, `opus`, `wma`
- Video: `mp4`, `webm`, `mov`, `m4v` (the API extracts the audio; no local ffmpeg)

Maximum upload size in this app is **150 MB**. English only (`language_code: en`).

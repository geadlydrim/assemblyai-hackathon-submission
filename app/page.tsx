import { Uploader } from "@/components/Uploader";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Subtitle Generator
      </h1>
      <p className="mt-3 text-base text-zinc-800 dark:text-zinc-200">
        Upload English audio or video to generate speaker-labelled subtitles
        (SRT and VTT).
      </p>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        Speakers are labelled A, B, C — not real names. Live captions are not
        in this phase.
      </p>
      <Uploader />
    </main>
  );
}

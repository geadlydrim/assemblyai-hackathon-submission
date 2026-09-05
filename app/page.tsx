import { Uploader } from "@/components/Uploader";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Subtitle Generator
      </h1>
      <p className="mt-3 text-center text-zinc-600 dark:text-zinc-400">
        Upload English audio or video to generate speaker-labelled subtitles.
      </p>
      <Uploader />
    </main>
  );
}

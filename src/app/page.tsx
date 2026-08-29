import Link from "next/link";
import {
  Mic,
  Sparkles,
  CircleCheckBig,
  FolderTree,
  Search,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { HeroPreview } from "@/components/marketing/hero-preview";

const STEPS = [
  {
    icon: CalendarDays,
    title: "Organize classes",
    body: "Add your subjects and weekly timetable. KELO knows what’s next and when.",
  },
  {
    icon: Mic,
    title: "Record lectures",
    body: "Capture audio in the browser with a live waveform — no app to install.",
  },
  {
    icon: Sparkles,
    title: "Understand & revise",
    body: "Automatic transcripts, summaries, key concepts, and exam-ready revision.",
  },
];

const FEATURES = [
  {
    icon: Mic,
    title: "Browser recording",
    body: "One tap to record, with pause, resume, and reliable upload — plus a local download safety net so a lecture is never lost.",
  },
  {
    icon: Sparkles,
    title: "AI that does real work",
    body: "A task-based router picks the best available model (Gemini, OpenAI, Grok, OpenRouter) and falls back automatically. Summaries, concepts, and revision — not a generic chatbot.",
  },
  {
    icon: CircleCheckBig,
    title: "Attendance that thinks ahead",
    body: "Per-subject percentages, how many classes you can safely miss, and exactly how many to attend to hit your target.",
  },
  {
    icon: FolderTree,
    title: "Google Drive, organized",
    body: "Recordings, transcripts, and summaries auto-file into KELO / Year / Semester / Subject. You never create a folder.",
  },
  {
    icon: Search,
    title: "Ask your lectures",
    body: "Semantic search across everything you’ve recorded, with answers grounded in your own material and linked back to the source.",
  },
  {
    icon: CalendarDays,
    title: "Your academic day",
    body: "A dashboard that shows the next class, today’s timeline, attendance health, and recent lectures — nothing noisy.",
  },
];

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          KELO
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-6rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        </div>
        <div className="container grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              Your academic class companion
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Record, understand, and revise every lecture.
            </h1>
            <p className="mt-4 max-w-md text-pretty text-muted-foreground">
              KELO turns your classes into organized recordings, clean
              transcripts, and exam-ready summaries — while tracking your
              attendance so you always know where you stand.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg">Get started free</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="secondary">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="container py-16 md:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Lectures move fast. Notes fall behind.
            </h2>
            <p className="mt-3 text-muted-foreground">
              You can’t write everything down, revision is scattered across
              apps, and attendance sneaks up on you. KELO keeps the recording,
              the understanding, and the tracking in one calm place.
            </p>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-16 md:py-24">
        <Reveal className="mb-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How KELO works
          </h2>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="container py-16 md:py-24">
          <Reveal className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything a student actually needs
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Function first. Every feature has a clear purpose.
            </p>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08}>
                <div className="h-full rounded-2xl border border-border bg-card p-6">
                  <f.icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-4 font-medium">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 md:py-28">
        <Reveal className="mx-auto max-w-2xl rounded-3xl border border-border bg-gradient-to-br from-primary/10 to-accent/40 p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Start with your next class.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Create an account with just your email and a 6-digit PIN.
          </p>
          <Link href="/signup" className="mt-8 inline-block">
            <Button size="lg">Get started free</Button>
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-border/60">
        <div className="container flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
          <span className="font-semibold text-foreground">KELO</span>
          <span>Your academic class companion.</span>
        </div>
      </footer>
    </div>
  );
}

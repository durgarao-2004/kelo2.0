"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Search as SearchIcon, RefreshCw } from "lucide-react";
import {
  askAction,
  searchAction,
  type AskState,
  type SearchState,
} from "@/server/search/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function SearchClient() {
  const [mode, setMode] = React.useState<"ask" | "search">("ask");
  const [ask, setAsk] = React.useState<AskState>({});
  const [search, setSearch] = React.useState<SearchState>({});
  const [pending, startTransition] = React.useTransition();

  function submitAsk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setAsk(await askAction({}, fd)));
  }
  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setSearch(await searchAction({}, fd)));
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setMode("ask")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            mode === "ask" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Ask my lectures
        </button>
        <button
          onClick={() => setMode("search")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            mode === "search" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Search
        </button>
      </div>

      {mode === "ask" ? (
        <div className="space-y-4">
          <form onSubmit={submitAsk} className="flex gap-2">
            <input
              name="question"
              placeholder="e.g. What did we cover about backpropagation?"
              className={inputClass}
              required
            />
            <Button type="submit" disabled={pending}>
              {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Ask
            </Button>
          </form>

          {ask.error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {ask.error}
            </p>
          ) : null}

          {ask.asked && !ask.error ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{ask.answer}</p>
              {ask.sources && ask.sources.length > 0 ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Sources</p>
                  <ul className="flex flex-wrap gap-2">
                    {ask.sources.map((s) => (
                      <li key={s.lectureId}>
                        <Link
                          href="/lectures"
                          className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs hover:bg-secondary/70"
                        >
                          {s.title}
                          {s.subjectName ? ` · ${s.subjectName}` : ""}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <form onSubmit={submitSearch} className="flex gap-2">
            <input
              name="query"
              placeholder="Search transcripts, summaries, concepts…"
              className={inputClass}
              required
            />
            <Button type="submit" disabled={pending}>
              {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
              Search
            </Button>
          </form>

          {search.error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {search.error}
            </p>
          ) : null}

          {search.searched && !search.error ? (
            search.hits && search.hits.length > 0 ? (
              <ul className="space-y-3">
                {search.hits.map((h, i) => (
                  <li key={`${h.lectureId}-${i}`} className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Link href="/lectures" className="font-medium hover:underline">
                        {h.title}
                      </Link>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                        {h.source}
                        {h.subjectName ? ` · ${h.subjectName}` : ""}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{h.excerpt}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No matches found.</p>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

"use client";

import { Building2, ClipboardCheck, Globe, Loader2, Search, Star, MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/api-client";

type Result = { id: string; group: string; title: string; subtitle?: string | null; href: string };

const ICONS: Record<string, typeof Building2> = {
  Clientes: Building2,
  Webs: Globe,
  "Google Business": Star,
  Reseñas: MessageSquareText,
  Auditorías: ClipboardCheck,
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api<{ results: Result[] }>(`/api/search?q=${encodeURIComponent(term)}`);
        if (!controller.signal.aborted) setResults(data.results);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const groups = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.group] ??= []).push(r);
    return acc;
  }, {});

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-full max-w-sm justify-start gap-2 text-muted-foreground sm:w-72"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="truncate">Buscar clientes, webs, reseñas…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Buscador global" description="Busca en todo el panel">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              if (v.trim().length < 2) setResults([]);
            }}
            placeholder="Nombre, WhatsApp, email, Location ID, URL, repositorio, Review ID…"
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando…
              </div>
            ) : (
              <CommandEmpty>{query.trim().length < 2 ? "Escribe al menos 2 caracteres" : "Sin resultados"}</CommandEmpty>
            )}
            {Object.entries(groups).map(([group, items]) => {
              const Icon = ICONS[group] ?? Search;
              return (
                <CommandGroup key={group} heading={group}>
                  {items.map((r) => (
                    <CommandItem key={r.id} value={r.id} onSelect={() => go(r.href)}>
                      <Icon className="size-4 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{r.title}</span>
                        {r.subtitle ? <span className="truncate text-xs text-muted-foreground">{r.subtitle}</span> : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Code2, Send, RefreshCw, Loader2, Brain, Book, Terminal, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

export default function ColonelLanguagePage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<any>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/colonel-language/status"],
    refetchInterval: 60000,
  });

  const { data: grammar } = useQuery<any>({
    queryKey: ["/api/colonel-language/grammar"],
  });

  const translateMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/colonel-language/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Translation failed");
      return res.json();
    },
    onSuccess: (data) => {
      setOutput(data);
    },
  });

  const rules = grammar?.rules || data?.rules || [
    { rule: "Commands are absolute — no passive voice", example: "Execute → do not 'try to execute'" },
    { rule: "Numbers are precise — no approximation", example: "87.3% not 'about 87%'" },
    { rule: "Time is Unix timestamps or ISO 8601", example: "1707091200 not 'yesterday'" },
    { rule: "Agents speak in first person sovereign voice", example: "I will complete → not 'it will be completed'" },
    { rule: "All reports end with next action", example: "NEXT: Execute phase 2" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Code2 size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Colonel Language</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Sovereign Communication Protocol</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-lg border border-border/30 bg-card/40 p-4">
          <h3 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
            <Book size={14} />
            Grammar Rules
          </h3>
          <div className="space-y-2">
            {rules.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="text-violet-400/60 font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-foreground/80">{r.rule}</div>
                  {r.example && <div className="text-muted-foreground font-mono mt-0.5">e.g. {r.example}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/30 bg-card/40 p-4">
          <h3 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
            <Terminal size={14} />
            Translate to Colonel
          </h3>
          <div className="flex gap-2 mb-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter text to translate to Colonel Language..."
              rows={3}
              className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
            />
            <button
              onClick={() => input.trim() && translateMutation.mutate(input.trim())}
              disabled={!input.trim() || translateMutation.isPending}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50 self-start"
            >
              {translateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          {output && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
              <div className="text-[10px] font-mono text-violet-400/60 mb-1">COLONEL OUTPUT:</div>
              <p className="text-sm font-mono text-violet-200">{output.result || output.translated || JSON.stringify(output)}</p>
            </div>
          )}
        </div>

        {data?.stats && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.stats).map(([key, val]) => (
              <div key={key} className="rounded-lg border border-border/30 bg-card/40 p-3">
                <div className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}</div>
                <div className="text-sm font-bold font-mono text-violet-300 mt-0.5">{String(val)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

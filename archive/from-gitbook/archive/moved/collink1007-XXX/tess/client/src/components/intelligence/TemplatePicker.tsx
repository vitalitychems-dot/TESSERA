import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BookTemplate, Play, Trash2, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface GoalTemplate {
  id: string;
  name: string;
  goal: string;
  description?: string;
  createdAt: number;
  lastUsedAt?: number;
  useCount: number;
}

interface Props {
  currentGoal: string;
  onRunGoal: (goal: string) => void;
  templateName: string;
  onTemplateNameChange: (name: string) => void;
}

export function TemplatePicker({ currentGoal, onRunGoal, templateName, onTemplateNameChange }: Props) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: templates = [] } = useQuery<GoalTemplate[]>({
    queryKey: ["/api/dag/templates"],
    refetchInterval: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/dag/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dag/templates"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/dag/templates", {
        name: templateName,
        goal: currentGoal,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dag/templates"] });
      setShowSaveForm(false);
      onTemplateNameChange("");
    },
  });

  const useMutate = useMutation({
    mutationFn: async (tpl: GoalTemplate) => {
      await apiRequest("POST", `/api/dag/templates/${tpl.id}/use`);
      queryClient.invalidateQueries({ queryKey: ["/api/dag/templates"] });
      return tpl.goal;
    },
    onSuccess: (goal) => {
      setOpen(false);
      onRunGoal(goal);
    },
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            open
              ? "bg-violet-950/40 border-violet-500/40 text-violet-300"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
          )}
        >
          <BookTemplate className="h-3.5 w-3.5" />
          Templates
          {templates.length > 0 && (
            <Badge className="text-xs bg-gray-700 ml-0.5">{templates.length}</Badge>
          )}
        </button>

        {currentGoal.trim() && (
          <button
            onClick={() => setShowSaveForm(!showSaveForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Save as template
          </button>
        )}
      </div>

      {showSaveForm && (
        <div className="mt-2 p-3 rounded-lg border border-violet-500/30 bg-violet-950/20 space-y-2">
          <p className="text-xs font-medium text-violet-300">Save current goal as template</p>
          <input
            value={templateName}
            onChange={e => onTemplateNameChange(e.target.value)}
            placeholder="Template name (e.g. 'Weekly analysis')"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
            onKeyDown={e => {
              if (e.key === "Enter" && templateName.trim() && currentGoal.trim()) {
                saveMutation.mutate();
              }
              if (e.key === "Escape") setShowSaveForm(false);
            }}
            autoFocus
          />
          <p className="text-xs text-muted-foreground line-clamp-1">Goal: {currentGoal}</p>
          <div className="flex gap-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!templateName.trim() || !currentGoal.trim() || saveMutation.isPending}
              className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium text-white transition-colors"
            >
              {saveMutation.isPending ? "Saving..." : "Save template"}
            </button>
            <button
              onClick={() => { setShowSaveForm(false); onTemplateNameChange(""); }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-2 rounded-lg border border-gray-700 bg-gray-900 shadow-xl overflow-hidden z-10 relative">
          {templates.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              <BookTemplate className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p>No templates yet</p>
              <p className="mt-1 opacity-60">Enter a goal above and save it as a template</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {templates.map(tpl => (
                <div key={tpl.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-gray-800/60 group transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-200">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tpl.goal}</p>
                    {tpl.useCount > 0 && (
                      <p className="text-xs text-muted-foreground opacity-50 mt-0.5">Used {tpl.useCount}×</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => useMutate.mutate(tpl)}
                      disabled={useMutate.isPending && useMutate.variables?.id === tpl.id}
                      className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 rounded text-xs font-medium text-white transition-colors"
                    >
                      {useMutate.isPending && useMutate.variables?.id === tpl.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Run
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(tpl.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

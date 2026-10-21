export type ReplyMode = "voice" | "text" | "both";
export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakText(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) return;
  stopSpeaking();
  const clean = text.replace(/[*_`#\[\]()>|~^]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .substring(0, 2000);
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => /samantha|karen|victoria|zira|hazel/i.test(v.name) && v.lang.startsWith("en"))
    || voices.find(v => v.lang.startsWith("en") && /female/i.test(v.name))
    || voices.find(v => v.lang.startsWith("en-"))
    || voices[0];

  let idx = 0;
  const speakNext = () => {
    if (idx >= sentences.length) { if (onEnd) onEnd(); return; }
    const utt = new SpeechSynthesisUtterance(sentences[idx].trim());
    utt.rate = 0.95; utt.pitch = 1.05; utt.volume = 0.85;
    if (preferred) utt.voice = preferred;
    utt.onend = () => { idx++; setTimeout(speakNext, 150); };
    utt.onerror = () => { idx++; setTimeout(speakNext, 100); };
    currentUtterance = utt;
    window.speechSynthesis.speak(utt);
  };
  speakNext();
}

export function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function copyToClipboard(text: string, setCopiedId: (id: string) => void, id: string) {
  navigator.clipboard.writeText(text).then(() => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 2000);
  });
}

export function downloadConversation(messages: any[]) {
  const text = messages.map(m => `[${m.role}]: ${m.content}`).join("\n\n---\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `tessera-conversation-${Date.now()}.txt`;
  a.click(); URL.revokeObjectURL(url);
}

export function VoiceVisualization({ state }: { state: VoiceState }) {
  if (state === "idle") return null;
  const colors: Record<VoiceState, string> = { idle: "", listening: "bg-red-500", thinking: "bg-yellow-500", speaking: "bg-cyan-500" };
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`w-1 rounded-full ${colors[state]} animate-pulse`} style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}

export function VoiceStateLabel({ state }: { state: VoiceState }) {
  const labels: Record<VoiceState, string> = { idle: "", listening: "Listening...", thinking: "Processing...", speaking: "Speaking..." };
  if (!labels[state]) return null;
  return <span className="text-xs text-gray-400">{labels[state]}</span>;
}

export function VoiceActivityIndicator({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
}

export function VoiceSettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute bottom-full mb-2 right-0 p-3 rounded-lg bg-gray-900 border border-white/10 shadow-xl z-50 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-300">Voice Settings</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xs" data-testid="button-close-voice-settings">×</button>
      </div>
      <div className="text-xs text-gray-400">Using browser speech synthesis</div>
    </div>
  );
}

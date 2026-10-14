import { memo } from "react";
import { FileIcon, ImageThumbnail, AudioFilePlayer, type UploadedFile } from "./ChatFileComponents";

interface ChatFileUploadAreaProps {
  uploadedFiles: UploadedFile[];
  conversationId: number;
  onSetInput: (val: string, current: string) => void;
  currentInput: string;
}

export const ChatFileUploadArea = memo(function ChatFileUploadArea({
  uploadedFiles, conversationId,
  onSetInput, currentInput,
}: ChatFileUploadAreaProps) {
  if (!Array.isArray(uploadedFiles)) {
    return (
      <p role="status" aria-live="polite" className="max-w-3xl mx-auto mb-2 text-xs text-amber-300/90">
        Attachments are unavailable. You can continue chatting.
      </p>
    );
  }
  if (uploadedFiles.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto mb-2 flex gap-2 flex-wrap items-end">
      {uploadedFiles.map(f => {
        if (f.mimeType.startsWith("image/")) {
          return <ImageThumbnail key={f.id} file={f} conversationId={conversationId} onAnalysis={(analysis) => {
            onSetInput(
              currentInput ? `${currentInput}\n\n[Image Analysis: ${analysis}]` : `Image analysis: ${analysis}`,
              currentInput
            );
          }} />;
        }
        if (f.mimeType.startsWith("audio/") || f.filename.match(/\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i)) {
          return <AudioFilePlayer key={f.id} file={f} conversationId={conversationId} />;
        }
        return (
          <div key={f.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px]">
            <FileIcon mimeType={f.mimeType} />
            <span className="text-gray-400 truncate max-w-[120px]">{f.filename}</span>
          </div>
        );
      })}
    </div>
  );
});

import { useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useCreateConversation } from "@/hooks/use-conversations";
import TesseraWorldStage from "@/components/TesseraWorldStage";

export default function ChatPage() {
  useEffect(() => {
    document.title = "TESSERA | World";
    const scrollContainer = document.querySelector("[data-scroll-container]");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }, []);
  const params = useParams<{ id: string }>();
  const conversationId = params.id ? parseInt(params.id, 10) : null;
  const { mutate: createConversation, isError, isPending } = useCreateConversation();
  const createdRef = useRef(false);

  useEffect(() => {
    if (!conversationId && !createdRef.current) {
      createdRef.current = true;
      createConversation({ title: "New Chat" });
    } else if (conversationId && Number.isInteger(conversationId) && conversationId > 0) {
      createdRef.current = false;
    }
  }, [conversationId, createConversation]);

  return (
    <div className="flex h-full min-h-0 w-full">
      {conversationId && Number.isInteger(conversationId) && conversationId > 0 ? (
        <TesseraWorldStage conversationId={conversationId} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#101a1b] p-8 text-center text-[#e9e5d7]">
          <div className="max-w-sm z-10">
            {isPending && <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#8bd0bd]/30 border-t-[#8bd0bd]" aria-label="Starting TESSERA world" />}
            <p className="mt-3 font-mono text-xs text-[#9b9b8a]" role={isError ? "alert" : "status"}>
              {isError ? "TESSERA could not start a conversation." : "Starting TESSERA world…"}
            </p>
            {isError && (
              <button
                type="button"
                className="mt-3 min-h-11 border border-[#8bd0bd]/40 px-4 font-mono text-xs text-[#8bd0bd] hover:bg-[#8bd0bd]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6bd70]"
                data-testid="button-retry-create-conversation"
                onClick={() => createConversation({ title: "New Chat" })}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

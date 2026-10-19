import { memo, useCallback, useEffect, useRef, useState } from "react";
import { CornerDownLeft, Delete, X } from "lucide-react";
import { NEXT_COLORS } from "@/lib/theme-constants";
import { LUS_KEYBOARD_GLYPHS } from "@/lib/lus-keyboard-map";

interface TesseraKeyboardProps {
  open: boolean;
  onInsert: (text: string) => void;
  onBackspace: () => void;
  onClose: () => void;
  onEnter?: () => void;
  enterLabel?: string;
  draftLabel?: string;
  fixed?: boolean;
}

const LETTER_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const NUMBER_ROWS = ["1234567890", "@#$%&-+()/", "*'\"=;:!?_"];

// Keep the key grid out of the chat's render loop. Callers can use inline
// callbacks without rebuilding every key whenever the draft changes.
export function TesseraKeyboard(props: TesseraKeyboardProps) {
  const callbacks = useRef(props);
  callbacks.current = props;
  const insert = useCallback((text: string) => callbacks.current.onInsert(text), []);
  const backspace = useCallback(() => callbacks.current.onBackspace(), []);
  const close = useCallback(() => callbacks.current.onClose(), []);
  const enter = useCallback(() => {
    if (callbacks.current.onEnter) callbacks.current.onEnter();
    else callbacks.current.onInsert("\n");
  }, []);
  return <KeyboardView {...props} onInsert={insert} onBackspace={backspace} onClose={close} onEnter={enter} />;
}

const KeyboardView = memo(function KeyboardView({
  open,
  onInsert,
  onBackspace,
  onClose,
  onEnter,
  enterLabel = "Insert line break",
  draftLabel = "Draft stays in this page until you choose Send.",
  fixed = false,
}: TesseraKeyboardProps) {
  const [uppercase, setUppercase] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const [heldKey, setHeldKey] = useState<string | null>(null);
  // One record per pointer lets two thumbs type without one cancelling the other.
  const presses = useRef(new Map<number, { key: string; timer: number; held: boolean }>());
  const deleteDelay = useRef<number | null>(null);
  const deleteRepeat = useRef<number | null>(null);
  const clearDelete = useCallback(() => {
    if (deleteDelay.current !== null) window.clearTimeout(deleteDelay.current);
    if (deleteRepeat.current !== null) window.clearInterval(deleteRepeat.current);
    deleteDelay.current = null;
    deleteRepeat.current = null;
  }, []);
  const clearPresses = useCallback(() => {
    for (const press of presses.current.values()) window.clearTimeout(press.timer);
    presses.current.clear();
    clearDelete();
  }, [clearDelete]);

  useEffect(() => {
    if (!open) {
      setHeldKey(null);
      clearPresses();
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      clearPresses();
    };
  }, [open, onClose, clearPresses]);

  if (!open) return null;

  const startHold = (key: string, pointerId: number) => {
    if (!/^[a-z]$/i.test(key) || !LUS_KEYBOARD_GLYPHS[key.toLowerCase()]) return;
    const previous = presses.current.get(pointerId);
    if (previous) window.clearTimeout(previous.timer);
    setHeldKey(null);
    const press = { key, timer: 0, held: false };
    press.timer = window.setTimeout(() => {
      press.held = true;
      setHeldKey(key);
    }, 260);
    presses.current.set(pointerId, press);
  };

  const cancelPress = (pointerId: number) => {
    const press = presses.current.get(pointerId);
    if (press) window.clearTimeout(press.timer);
    presses.current.delete(pointerId);
    if (press?.held) setHeldKey(null);
  };

  const finishLetterPress = (pointerId: number, key: string, visibleKey: string) => {
    const press = presses.current.get(pointerId);
    if (!press || press.key !== key) return;
    window.clearTimeout(press.timer);
    presses.current.delete(pointerId);
    if (press.held) return;
    setHeldKey(null);
    onInsert(visibleKey);
    setUppercase(false);
  };

  const renderLetter = (key: string) => {
    const visibleKey = uppercase ? key.toUpperCase() : key;
    const glyph = LUS_KEYBOARD_GLYPHS[key.toLowerCase()];
    return (
      <div className="relative min-w-0 flex-1" key={key}>
        <button
          type="button"
          aria-label={`Type ${visibleKey}. Hold for its LUS glyph.`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic or cancelled pointer */ }
            startHold(key, event.pointerId);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            finishLetterPress(event.pointerId, key, visibleKey);
          }}
          onPointerCancel={(event) => cancelPress(event.pointerId)}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            // Pointer input is committed on release; detail=0 preserves
            // keyboard/screen-reader activation without duplicate characters.
            if (event.detail !== 0) return;
            setHeldKey(null);
            onInsert(visibleKey);
            setUppercase(false);
          }}
          className="h-10 sm:h-11 w-full touch-manipulation select-none rounded-md border border-white/[0.09] bg-white/[0.11] text-[18px] sm:text-[20px] font-medium text-[#f3efe6] active:bg-white/[0.2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
          style={{ outlineColor: NEXT_COLORS.glass, touchAction: "none" }}
          data-testid={`tessera-key-${key}`}
        >
          {visibleKey}
        </button>
        {heldKey === key && (
          <div
            role="group"
            aria-label={`Choose English ${visibleKey} or its LUS glyph`}
            className="absolute bottom-[calc(100%+8px)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/15 bg-[#10151b] p-1.5 shadow-xl"
            data-testid="tessera-long-press-options"
          >
            <button
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              aria-label={`Type English ${visibleKey}`}
              onClick={() => {
                onInsert(visibleKey);
                setHeldKey(null);
                setUppercase(false);
              }}
              className="min-h-11 min-w-11 rounded-lg px-3 text-lg text-[#f3efe6] hover:bg-white/10 focus-visible:outline focus-visible:outline-2"
              style={{ outlineColor: NEXT_COLORS.glass }}
            >
              {visibleKey}
            </button>
            <span aria-hidden="true" className="h-7 w-px bg-white/15" />
            <button
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              aria-label={`Type LUS glyph ${glyph} for ${visibleKey}`}
              onClick={() => {
                onInsert(glyph);
                setHeldKey(null);
                setUppercase(false);
              }}
              className="min-h-11 min-w-11 rounded-lg px-3 text-lg hover:bg-white/10 focus-visible:outline focus-visible:outline-2"
              style={{ color: NEXT_COLORS.glass, outlineColor: NEXT_COLORS.glass }}
            >
              {glyph}
              <span className="ml-1 text-[9px] font-mono uppercase tracking-wide text-white/45">LUS</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      className={`${
        fixed
          ? "fixed left-2 right-2 z-[10001] mx-auto max-w-xl"
          : "mx-auto mt-2 w-full max-w-3xl"
      } rounded-xl border border-white/15 bg-[#10151b] px-2 pb-2 pt-2`}
      style={fixed ? { bottom: "max(8px, env(safe-area-inset-bottom, 0px))" } : undefined}
      role="group"
      aria-label="Tessera on-screen keyboard"
      data-testid="tessera-keyboard"
    >
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
        <span>Tessera · LUS</span>
        <span>Hold a letter for its glyph</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Tessera keyboard"
          className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
          data-testid="button-close-tessera-keyboard"
        >
          <X size={15} />
        </button>
      </div>
      <p className="sr-only">
        {draftLabel}
      </p>

      {numbers ? (
        <div className="space-y-1.5">
          {NUMBER_ROWS.map((row) => (
            <div className="flex gap-1" key={row}>
              {Array.from(row).map((key, index) => (
                <button
                  type="button"
                  key={`${key}-${index}`}
                  onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); onInsert(key); } }}
                  onClick={(event) => { if (event.detail === 0) onInsert(key); }}
                  className="h-10 min-w-0 flex-1 touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] text-[16px] text-[#f3efe6] active:bg-white/[0.2] focus-visible:outline focus-visible:outline-2"
                  style={{ outlineColor: NEXT_COLORS.glass, touchAction: "manipulation" }}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {LETTER_ROWS.map((row, rowIndex) => (
            <div
              className={`flex gap-1 ${rowIndex === 1 ? "px-[4%]" : ""} ${rowIndex === 2 ? "items-center" : ""}`}
              key={row}
            >
              {rowIndex === 2 && (
                <button
                  type="button"
                  aria-label={uppercase ? "Turn off uppercase" : "Turn on uppercase"}
                  aria-pressed={uppercase}
                  onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); setUppercase((value) => !value); } }}
                  onClick={(event) => { if (event.detail === 0) setUppercase((value) => !value); }}
                  className="h-10 min-w-10 touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] px-2 text-sm text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
                  style={{ outlineColor: NEXT_COLORS.glass }}
                >
                  ⇧
                </button>
              )}
              {Array.from(row).map(renderLetter)}
              {rowIndex === 2 && (
                <button
                  type="button"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic or cancelled pointer */ }
                    clearDelete();
                    onBackspace();
                    deleteDelay.current = window.setTimeout(() => {
                      deleteRepeat.current = window.setInterval(onBackspace, 55);
                    }, 300);
                  }}
                  onPointerUp={clearDelete}
                  onPointerCancel={clearDelete}
                  onLostPointerCapture={clearDelete}
                  onClick={(event) => { if (event.detail === 0) onBackspace(); }}
                  aria-label="Delete previous character"
                  className="grid h-10 min-w-10 touch-manipulation place-items-center rounded-md border border-white/[0.09] bg-white/[0.11] px-2 text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
                  style={{ outlineColor: NEXT_COLORS.glass }}
                >
                  <Delete size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex gap-1">
        <button
          type="button"
          onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); setNumbers((value) => !value); } }}
          onClick={(event) => { if (event.detail === 0) setNumbers((value) => !value); }}
          className="h-10 min-w-[52px] touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] px-3 text-sm text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
          data-testid="button-keyboard-numbers"
        >
          {numbers ? "ABC" : "123"}
        </button>
        <button
          type="button"
          onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); onInsert(","); } }}
          onClick={(event) => { if (event.detail === 0) onInsert(","); }}
          aria-label="Type comma"
          className="h-10 min-w-9 touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] px-2 text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
        >
          ,
        </button>
        <button
          type="button"
          onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); onInsert(" "); } }}
          onClick={(event) => { if (event.detail === 0) onInsert(" "); }}
          aria-label="Space"
          className="h-10 flex-1 touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] text-[10px] text-white/50 focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
        >
          space
        </button>
        <button
          type="button"
          onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); onInsert("."); } }}
          onClick={(event) => { if (event.detail === 0) onInsert("."); }}
          aria-label="Type period"
          className="h-10 min-w-9 touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] px-2 text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
        >
          .
        </button>
        <button
          type="button"
          onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); onEnter ? onEnter() : onInsert("\n"); } }}
          onClick={(event) => { if (event.detail === 0) { onEnter ? onEnter() : onInsert("\n"); } }}
          aria-label={enterLabel}
          className="grid h-10 min-w-12 touch-manipulation place-items-center rounded-md border border-white/[0.09] bg-white/[0.11] px-2 text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
        >
          <CornerDownLeft size={17} />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {heldKey ? `Long press options for ${heldKey} are open.` : ""}
      </p>
    </section>
  );
});

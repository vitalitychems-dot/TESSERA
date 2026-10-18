import { useEffect, useRef, useState } from "react";
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

export function TesseraKeyboard({
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
  const holdTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const suppressClickUntil = useRef(0);
  const pointerPressedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setHeldKey(null);
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
      longPressTriggered.current = false;
      suppressClickUntil.current = 0;
      pointerPressedKey.current = null;
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const startHold = (key: string) => {
    if (!/^[a-z]$/i.test(key) || !LUS_KEYBOARD_GLYPHS[key.toLowerCase()]) return;
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    longPressTriggered.current = false;
    holdTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setHeldKey(key);
    }, 360);
  };

  const clearHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const finishLetterPress = (visibleKey: string) => {
    clearHold();
    suppressClickUntil.current = performance.now() + 100;
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
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
            pointerPressedKey.current = key;
            startHold(key);
          }}
          onPointerUp={(event) => {
            if (pointerPressedKey.current !== key) return;
            event.preventDefault();
            pointerPressedKey.current = null;
            finishLetterPress(visibleKey);
          }}
          onPointerCancel={() => {
            clearHold();
            longPressTriggered.current = false;
            pointerPressedKey.current = null;
          }}
          onPointerLeave={() => {
            if (!longPressTriggered.current) {
              clearHold();
              pointerPressedKey.current = null;
            }
          }}
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => {
            if (suppressClickUntil.current > performance.now()) {
              suppressClickUntil.current = 0;
              return;
            }
            setHeldKey(null);
            onInsert(visibleKey);
            setUppercase(false);
          }}
          className="h-10 sm:h-11 w-full touch-manipulation select-none rounded-md border border-white/[0.09] bg-white/[0.11] text-[18px] sm:text-[20px] font-medium text-[#f3efe6] active:bg-white/[0.2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
          style={{ outlineColor: NEXT_COLORS.glass, touchAction: "manipulation" }}
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
          ? "fixed bottom-2 left-2 right-2 z-[10001] mx-auto max-w-xl"
          : "mx-auto mt-2 w-full max-w-3xl"
      } rounded-2xl border border-white/10 bg-[#10151b]/95 px-2 pb-2 pt-2 shadow-2xl backdrop-blur-xl`}
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
      <p className="mb-2 px-1 text-[10px] text-white/45">
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
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => onInsert(key)}
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
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => setUppercase((value) => !value)}
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
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={onBackspace}
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
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setNumbers((value) => !value)}
          className="h-10 min-w-[52px] touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] px-3 text-sm text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
          data-testid="button-keyboard-numbers"
        >
          {numbers ? "ABC" : "123"}
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onInsert(",")}
          aria-label="Type comma"
          className="h-10 min-w-9 touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] px-2 text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
        >
          ,
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onInsert(" ")}
          aria-label="Space"
          className="h-10 flex-1 touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] text-[10px] text-white/50 focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
        >
          space
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onInsert(".")}
          aria-label="Type period"
          className="h-10 min-w-9 touch-manipulation rounded-md border border-white/[0.09] bg-white/[0.11] px-2 text-[#f3efe6] focus-visible:outline focus-visible:outline-2"
          style={{ outlineColor: NEXT_COLORS.glass }}
        >
          .
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onEnter ? onEnter() : onInsert("\n")}
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
}

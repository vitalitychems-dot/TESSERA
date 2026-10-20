import { TESSERA } from "@/lib/tessera/identity";

/** A tight crop of the portrait's eyes. This is her picture, not a camera. */

export function RealEye({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-full ring-2 ring-accent ${className}`}>
      <img
        src={TESSERA.face}
        alt="Her eye"
        className="absolute inset-0 h-full w-full max-w-none object-cover"
        style={{ objectPosition: "50% 46%", transform: "scale(3.1)" }}
      />
    </div>
  );
}

import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Product, Variant } from "@/lib/catalog";
import { hasExactPhoto, productImage, displayPurity, RECON_ID } from "@/lib/catalog";
import { useCart } from "@/lib/cart-store";
import { afterBulk, BULK_TIERS, money } from "@/lib/pricing";
import { cn, formatPrice } from "@/lib/utils";
import { trackClient } from "@/components/analytics-tracker";
import { ProductInfo } from "@/components/product-info";

function SpecArt({ product }: { product: Product }) {
  return (
    <div className="relative overflow-hidden rounded-t-md bg-[#0a0812] px-3 pt-3 pb-2">
      <div
        className="pointer-events-none absolute -top-6 -right-4 h-28 w-28 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgb(163 59 255 / 0.55) 0%, rgb(42 32 255 / 0.2) 45%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-8 right-8 h-16 w-16 rounded-full"
        style={{
          background: "radial-gradient(circle, rgb(188 63 255 / 0.4), transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-1.5">
        <img src="/brand/logo.png" alt="" className="h-5 w-5 object-contain" />
        <p className="font-mono text-[8px] tracking-widest text-primary uppercase">
          Documented · research use only
        </p>
      </div>
      <p className="font-display relative mt-3 text-xl font-semibold tracking-wide text-fg uppercase">
        {product.name}
      </p>
      <dl className="relative mt-3 space-y-1.5 text-[10px]">
        <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
          <dt className="tracking-widest text-primary uppercase">Form</dt>
          <dd className="text-right text-muted">{product.form}</dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
          <dt className="tracking-widest text-primary uppercase">MW</dt>
          <dd className="text-right font-mono text-muted">{product.molecularWeight ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2 pb-1">
          <dt className="tracking-widest text-primary uppercase">CAS</dt>
          <dd className="text-right font-mono text-muted">{product.casNumber ?? "—"}</dd>
        </div>
      </dl>
      <div className="relative mt-2 flex flex-wrap gap-1">
        {["Research use only", "Not for human consumption", "HPLC identity"].map((t) => (
          <span
            key={t}
            className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[8px] tracking-wide text-faint uppercase"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProductPhoto({
  product,
  variant,
  tall = false,
  children,
}: {
  product: Product;
  variant: Variant;
  tall?: boolean;
  children?: ReactNode;
}) {
  const src = productImage(product.name, variant.dose, product.formKind);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <SpecArt product={product} />;

  return (
    <div className={cn("vial-stage relative bg-bg", tall ? "aspect-[4/5]" : "catalog-photo")}>
      <img
        key={`${product.id}-${variant.dose}-${src}`}
        src={src}
        alt={`${product.name} ${variant.dose} research material`}
        width={800}
        height={1000}
        draggable={false}
        decoding="async"
        onError={() => setFailedSrc(src)}
        className="pointer-events-none h-full w-full object-contain object-center select-none"
      />
      {children}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const [doseIndex, setDoseIndex] = useState(0);
  const variant = product.variants[doseIndex] ?? product.variants[0];
  const addItem = useCart((s) => s.addItem);
  const image = productImage(product.name, variant.dose, product.formKind);
  const canBulk = product.id !== RECON_ID && product.formKind === "vial";
  const pack = BULK_TIERS[0];
  const packPrice = afterBulk(variant.price * pack.qty, pack.qty);
  const packSave = money(variant.price * pack.qty - packPrice);
  const studio = product.formKind === "vial" && hasExactPhoto(product.name, variant.dose);

  const add = (quantity: number) => {
    addItem({
      productId: product.id,
      name: product.name,
      doseLabel: variant.dose,
      unitPrice: variant.price,
      image,
      quantity,
    });
    trackClient("add_to_cart", { productId: product.id, productName: product.name });
  };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface">
      <Link to="/product/$id" params={{ id: product.id }} className="block">
        {studio ? <ProductPhoto product={product} variant={variant} /> : <SpecArt product={product} />}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-1">
          <Link to="/product/$id" params={{ id: product.id }} className="min-w-0">
            <h3 className="font-display truncate text-sm font-semibold tracking-wide uppercase group-hover:text-primary sm:text-base">
              {product.name}
            </h3>
          </Link>
          <ProductInfo product={product} />
        </div>
        <p className="font-mono text-[10px] tracking-widest text-faint uppercase">
          {variant.dose} · {displayPurity(product.name, variant.dose)} HPLC
        </p>
        {product.variants.length > 1 && (
          <div
            className="flex flex-wrap overflow-hidden rounded-sm border border-border"
            role="group"
            aria-label="Select catalog quantity"
          >
            {product.variants.map((v, i) => (
              <button
                key={v.dose}
                type="button"
                aria-pressed={i === doseIndex}
                onClick={() => setDoseIndex(i)}
                className={cn(
                  "min-h-8 flex-1 px-0.5 py-1 font-mono text-[9px] font-bold tracking-wider uppercase sm:min-h-9 sm:text-[10px]",
                  i === doseIndex
                    ? "bg-primary text-primary-fg"
                    : "bg-overlay text-muted hover:text-fg",
                )}
              >
                {v.dose}
              </button>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="font-display text-lg font-semibold tabular-nums sm:text-xl">
            {formatPrice(variant.price)}
          </p>
          <button
            type="button"
            onClick={() => add(1)}
            className="relative z-10 inline-flex min-h-10 shrink-0 items-center rounded-sm bg-primary px-3 font-display text-[11px] font-bold tracking-widest text-primary-fg uppercase hover:bg-primary-deep"
          >
            Add
          </button>
        </div>
        {canBulk && (
          <button
            type="button"
            onClick={() => add(pack.qty)}
            className="w-full truncate text-left text-[10px] text-muted hover:text-primary sm:text-[11px]"
          >
            Add {pack.qty} · {formatPrice(packPrice)}{" "}
            <span className="text-primary">save {formatPrice(packSave)}</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function MetaRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs tracking-wider text-faint uppercase">
        {icon}
        {label}
      </dt>
      <dd className="font-mono text-sm text-fg">{value}</dd>
    </div>
  );
}
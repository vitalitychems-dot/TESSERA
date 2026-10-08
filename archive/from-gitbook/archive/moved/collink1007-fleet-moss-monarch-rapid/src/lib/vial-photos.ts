/**
 * Only keys that were read off the user's studio bottles (IMG_ attachments).
 * Missing keys → SpecArt. Never serve a bottle that belongs to another compound.
 */
const V = "real1";

const PHOTOS: Record<string, string> = {
  "5-amino-1mq-5mg": `/vials/5-amino-1mq-5mg.jpg?v=${V}`,
  "aod-9604-5mg": `/vials/aod-9604-5mg.jpg?v=${V}`,
  "ara-290-10mg": `/vials/ara-290-10mg.jpg?v=${V}`,
  "bpc-157-10mg": `/vials/bpc-157-10mg.jpg?v=${V}`,
  "bpc-157-5mg": `/vials/bpc-157-5mg.jpg?v=${V}`,
  "bpc-tb-blend-10mg-10mg": `/vials/bpc-tb-blend-10mg-10mg.jpg?v=${V}`,
  "cjc-1295-no-dac-10mg": `/vials/cjc-1295-no-dac-10mg.jpg?v=${V}`,
  "cjc-1295-no-dac-5mg": `/vials/cjc-1295-no-dac-5mg.jpg?v=${V}`,
  "cjc-1295-w-o-dac-ipamorelin-5mg-5mg": `/vials/cjc-1295-w-o-dac-ipamorelin-5mg-5mg.jpg?v=${V}`,
  "cjc-1295-with-dac-5mg": `/vials/cjc-1295-with-dac-5mg.jpg?v=${V}`,
  "dsip-5mg": `/vials/dsip-5mg.jpg?v=${V}`,
  "epithalon-10mg": `/vials/epithalon-10mg.jpg?v=${V}`,
  "epithalon-50mg": `/vials/epithalon-50mg.jpg?v=${V}`,
  "frag-176-191-5mg": `/vials/frag-176-191-5mg.jpg?v=${V}`,
  "ghk-cu-100mg": `/vials/ghk-cu-100mg.jpg?v=${V}`,
  "ghk-cu-50mg": `/vials/ghk-cu-50mg.jpg?v=${V}`,
  "ghrp-2-10mg": `/vials/ghrp-2-10mg.jpg?v=${V}`,
  "ghrp-2-5mg": `/vials/ghrp-2-5mg.jpg?v=${V}`,
  "ghrp-6-10mg": `/vials/ghrp-6-10mg.jpg?v=${V}`,
  "ghrp-6-5mg": `/vials/ghrp-6-5mg.jpg?v=${V}`,
  "glow-10-10-50mg": `/vials/glow-10-10-50mg.jpg?v=${V}`,
  "glutathione-1500mg": `/vials/glutathione-1500mg.jpg?v=${V}`,
  "igf-1-lr3-1mg": `/vials/igf-1-lr3-1mg.jpg?v=${V}`,
  "ipamorelin-10mg": `/vials/ipamorelin-10mg.jpg?v=${V}`,
  "kisspeptin-5mg": `/vials/kisspeptin-5mg.jpg?v=${V}`,
  "klow-80mg": `/vials/klow-80mg.jpg?v=${V}`,
  "kpv-10mg": `/vials/kpv-10mg.jpg?v=${V}`,
  "ll-37-5mg": `/vials/ll-37-5mg.jpg?v=${V}`,
  "mots-c-10mg": `/vials/mots-c-10mg.jpg?v=${V}`,
  "mots-c-40mg": `/vials/mots-c-40mg.jpg?v=${V}`,
  "nad-500mg": `/vials/nad-500mg.jpg?v=${V}`,
  "pt-141-10mg": `/vials/pt-141-10mg.jpg?v=${V}`,
  "retatrutide-10mg": `/vials/retatrutide-10mg.jpg?v=${V}`,
  "retatrutide-20mg": `/vials/retatrutide-20mg.jpg?v=${V}`,
  "retatrutide-30mg": `/vials/retatrutide-30mg.jpg?v=${V}`,
  "selank-10mg": `/vials/selank-10mg.jpg?v=${V}`,
  "selank-5mg": `/vials/selank-5mg.jpg?v=${V}`,
  "semaglutide-10mg": `/vials/semaglutide-10mg.jpg?v=${V}`,
  "semaglutide-15mg": `/vials/semaglutide-15mg.jpg?v=${V}`,
  "semaglutide-20mg": `/vials/semaglutide-20mg.jpg?v=${V}`,
  "semaglutide-30mg": `/vials/semaglutide-30mg.jpg?v=${V}`,
  "semaglutide-5mg": `/vials/semaglutide-5mg.jpg?v=${V}`,
  "semax-10mg": `/vials/semax-10mg.jpg?v=${V}`,
  "ss-31-10mg": `/vials/ss-31-10mg.jpg?v=${V}`,
  "ss-31-50mg": `/vials/ss-31-50mg.jpg?v=${V}`,
  "tb-500-10mg": `/vials/tb-500-10mg.jpg?v=${V}`,
  "tb-500-5mg": `/vials/tb-500-5mg.jpg?v=${V}`,
  "tesamorelin-10mg": `/vials/tesamorelin-10mg.jpg?v=${V}`,
  "tesamorelin-5mg": `/vials/tesamorelin-5mg.jpg?v=${V}`,
  "thymalin-10mg": `/vials/thymalin-10mg.jpg?v=${V}`,
  "thymosin-alpha-1-ta1-5mg": `/vials/thymosin-alpha-1-ta1-5mg.jpg?v=${V}`,
  "tirzepatide-10mg": `/vials/tirzepatide-10mg.jpg?v=${V}`,
  "tirzepatide-15mg": `/vials/tirzepatide-15mg.jpg?v=${V}`,
  "tirzepatide-20mg": `/vials/tirzepatide-20mg.jpg?v=${V}`,
  "tirzepatide-30mg": `/vials/tirzepatide-30mg.jpg?v=${V}`,
  "tirzepatide-60mg": `/vials/tirzepatide-60mg.jpg?v=${V}`,
  "vip-10mg": `/vials/vip-10mg.jpg?v=${V}`,
};

PHOTOS["glow-10mg-10mg-50mg"] = PHOTOS["glow-10-10-50mg"]!;
PHOTOS["wolverine-10mg-10mg"] = PHOTOS["bpc-tb-blend-10mg-10mg"]!;

export function hashedVial(nameSlug: string, doseSlug?: string): string | undefined {
  if (!doseSlug) return undefined;
  const exact = PHOTOS[`${nameSlug}-${doseSlug}`];
  if (exact) return exact;
  const compact = doseSlug.replace(/-and-/g, "-");
  return PHOTOS[`${nameSlug}-${compact}`];
}

export function hasHashedVial(nameSlug: string, doseSlug?: string) {
  return Boolean(hashedVial(nameSlug, doseSlug));
}

import type { CareCategory } from "@/generated/prisma/enums"

/**
 * Buckets a Service name into one of the clinic's 3 real treatment
 * categories (zafoorclinic.com) — used wherever revenue/activity needs to
 * be split by department instead of by the (much more granular) service
 * name. Services without an obvious match fall back to General Medicine
 * rather than an "Other" bucket, since every real service is one of these 3.
 */
export function classifyServiceName(name: string | null | undefined): CareCategory {
  const s = (name ?? "").toLowerCase()
  if (
    s.includes("skin") ||
    s.includes("hair") ||
    s.includes("acne") ||
    s.includes("laser") ||
    s.includes("prp") ||
    s.includes("gfc") ||
    s.includes("peel") ||
    s.includes("facial") ||
    s.includes("derma") ||
    s.includes("cosmetic") ||
    s.includes("aesthetic") ||
    s.includes("melasma") ||
    s.includes("pigmentation") ||
    s.includes("tanning") ||
    s.includes("wart") ||
    s.includes("pores") ||
    s.includes("dandruff") ||
    s.includes("weight")
  ) {
    return "SKIN_HAIR_LASER"
  }
  if (
    s.includes("diabet") ||
    s.includes("sugar") ||
    s.includes("glucose") ||
    s.includes("insulin") ||
    s.includes("neuropathy") ||
    s.includes("foot") ||
    s.includes("complication")
  ) {
    return "DIABETOLOGY"
  }
  return "GENERAL_MEDICINE"
}

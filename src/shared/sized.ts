import type { Sized } from "./schema";

/**
 * Size-dependent values. Text writes them inline as "{84|88|96}" (one value
 * per size); numbers are a single value or one per size.
 */

/** Text for one size: each "{a|b|c}" becomes that size's value. */
export function textForSize(text: string, size: number): string {
  return text.replace(/\{([^{}]*)\}/g, (_, alts: string) => alts.split("|")[size] ?? alts);
}

export function valueForSize<T>(v: Sized<T> | undefined, size: number): T | undefined {
  return Array.isArray(v) ? v[size] : v;
}

/** Whether a node limited to `sizes` (omitted = all) applies to this size. */
export const appliesToSize = (sizes: number[] | undefined, size: number) => !sizes || sizes.length === 0 || sizes.includes(size);

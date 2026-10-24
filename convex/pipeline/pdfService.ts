"use node";

import { unzipSync } from "fflate";
import { env } from "../_generated/server";

/** Calls the hosted PDF service (pdf_service/service.py); its answer is a zip, returned as files by name. */
export async function callPdfService(op: "extract" | "crops" | "grid", body: object): Promise<Record<string, Uint8Array>> {
  if (!env.PDF_SERVICE_URL || !env.PDF_SERVICE_TOKEN) throw new Error("The PDF service isn't set up: set PDF_SERVICE_URL and PDF_SERVICE_TOKEN (see pdf_service/modal_app.py)");
  const res = await fetch(`${env.PDF_SERVICE_URL.replace(/\/$/, "")}/${op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.PDF_SERVICE_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PDF service ${op}: ${res.status} ${await res.text()}`);
  return unzipSync(new Uint8Array(await res.arrayBuffer()));
}

export const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

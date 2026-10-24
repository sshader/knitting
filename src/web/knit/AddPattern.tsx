import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { dollars } from "../../extract/pricing";

/**
 * Upload a pattern's PDF (or PDFs, when the charts come separately) to
 * extract it. PDFs someone already extracted are reused at no cost;
 * otherwise extraction is charged at the model's actual cost.
 */
export function AddPattern() {
  const credits = useQuery(api.credits.mine);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const claim = useMutation(api.files.claim);
  const importPattern = useMutation(api.pipeline.start.importPattern);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const uploaded = [];
      for (const [i, file] of files.entries()) {
        setStatus(`Uploading ${files.length > 1 ? `${i + 1} of ${files.length}` : file.name}…`);
        const res = await fetch(await generateUploadUrl(), { method: "POST", headers: { "Content-Type": "application/pdf" }, body: file });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const { storageId } = await res.json();
        await claim({ file: storageId });
        uploaded.push({ file: storageId, name: file.name });
      }
      setStatus("Starting…");
      const { copied } = await importPattern({ files: uploaded, title: title.trim() || undefined });
      setStatus(copied ? "Added: this PDF was extracted before, so its results were copied for free." : "Extracting; it'll appear below when it's ready.");
      setFiles([]);
      setTitle("");
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : String(e));
    }
  }

  return (
    <div className="add-pattern">
      <label className="file-pick">
        <input type="file" accept="application/pdf" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
        <span>{files.length ? files.map((f) => f.name).join(" + ") : "Choose PDF(s)…"}</span>
      </label>
      <input placeholder="Name (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button className="primary" disabled={!files.length || !!status?.endsWith("…")} onClick={() => void submit()}>
        Add pattern
      </button>
      <p className="small muted">
        {credits == null ? "" : `You have ${dollars(credits * 1e6)} of credit. `}
        Extracting costs what the model calls cost: about $0.50–$1.50 for a typical pattern. PDFs already extracted are free. If a pattern ships its charts as a
        separate PDF, choose both.
      </p>
      {status && <p className="small">{status}</p>}
      {error && <p className="small bad">{error}</p>}
    </div>
  );
}

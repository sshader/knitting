import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import "./knit.css";
import { ProjectList } from "./ProjectList";
import { Workspace } from "./Workspace";

/** The pattern viewer: your projects, or the one you're knitting (?project=<id>). */
export function KnitView() {
  const [projectId, setProjectId] = useState(() => new URLSearchParams(location.search).get("project") as Id<"projects"> | null);
  const open = (id: Id<"projects"> | null) => {
    const params = new URLSearchParams(location.search);
    if (id) params.set("project", id);
    else params.delete("project");
    history.replaceState(null, "", `?${params}`);
    setProjectId(id);
  };
  return projectId ? <Workspace projectId={projectId} onExit={() => open(null)} /> : <ProjectList onOpen={open} />;
}

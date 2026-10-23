import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SettingsMenu } from "../SettingsMenu";
import { NewProject } from "./NewProject";

/** Your projects, most recent first, and a form to start another. */
export function ProjectList({ onOpen }: { onOpen: (id: Id<"projects">) => void }) {
  const projects = useQuery(api.projects.list);
  const remove = useMutation(api.projects.remove);
  return (
    <div className="projects">
      <section>
        <header className="projects-head">
          <h1>Knitting</h1>
          <SettingsMenu />
        </header>
        {projects?.length === 0 && <p className="muted">No projects yet. Start one below.</p>}
        <ul className="project-cards">
          {projects?.map((p) => (
            <li key={p._id}>
              <button className="project-card" onClick={() => onOpen(p._id)}>
                <b>{p.name}</b>
                <span className="muted">
                  {p.choices.length ? `${p.choices.join(" · ")} · ` : ""}step {p.position.step + 1}
                </span>
                <span className="muted small">Last knitted {new Date(p.lastWorkedAt).toLocaleDateString()}</span>
              </button>
              <button
                className="quiet small"
                onClick={() => {
                  if (confirm(`Delete "${p.name}"? Your place in it will be lost.`)) void remove({ projectId: p._id });
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Start a project</h2>
        <NewProject onStarted={onOpen} />
      </section>
    </div>
  );
}

import type { Pattern } from "./schema";
import type { Project, ProjectEvent } from "./project";

/**
 * Persistence boundary. Everything is async so a JSON-file, SQLite, or Convex
 * adapter can sit behind it. Adapters validate on read with the zod schemas.
 */
export interface PatternSummary {
  id: string;
  title: string;
  designer?: string;
}

export interface Store {
  patterns: {
    list(): Promise<PatternSummary[]>;
    get(id: string): Promise<Pattern | null>;
    put(pattern: Pattern): Promise<void>;
  };
  projects: {
    list(): Promise<Project[]>;
    get(id: string): Promise<Project | null>;
    put(project: Project): Promise<void>;
  };
  events: {
    append(event: ProjectEvent): Promise<void>;
    list(projectId: string): Promise<ProjectEvent[]>;
  };
}

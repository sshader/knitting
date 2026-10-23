import { useAuthActions } from "@convex-dev/auth/react";
import type { ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { useMode, type Mode } from "./mode";

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: "knit", label: "Knit", hint: "Work through your projects" },
  { mode: "extract", label: "Pattern extraction", hint: "Review the pipeline's output" },
];

/** The gear menu: which mode you're in, anything the current screen adds (like panels), and signing out. */
export function SettingsMenu({ children }: { children?: (close: () => void) => ReactNode }) {
  const { mode, setMode } = useMode();
  const { signOut } = useAuthActions();
  return (
    <Dropdown label="⚙" title="Settings">
      {(close) => (
        <>
          <div className="menu-heading">Mode</div>
          {MODES.map((m) => (
            <button
              key={m.mode}
              className={`menu-item ${m.mode === mode ? "on" : ""}`}
              onClick={() => {
                setMode(m.mode);
                close();
              }}
            >
              <span>{m.label}</span>
              <span className="menu-hint">{m.hint}</span>
            </button>
          ))}
          {children && (
            <>
              <hr />
              {children(close)}
            </>
          )}
          <hr />
          <button className="menu-item" onClick={() => void signOut()}>
            Sign out
          </button>
        </>
      )}
    </Dropdown>
  );
}

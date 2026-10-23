import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { useState } from "react";

/**
 * Email and password; the pipeline scripts sign in with the same account
 * (KNITTING_EMAIL / KNITTING_PASSWORD in .env). Creating an account takes an invite code.
 */
export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="sign-in"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const data = new FormData(e.currentTarget);
        data.set("flow", flow);
        signIn("password", data).catch((err) =>
          setError(flow === "signIn" ? "Wrong email or password" : err instanceof ConvexError ? String(err.data) : "Couldn't create that account"),
        );
      }}
    >
      <h1>Knitting inspector</h1>
      <input name="email" type="email" placeholder="Email" autoComplete="email" required />
      <input name="password" type="password" placeholder="Password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} required />
      {flow === "signUp" && <input name="inviteCode" placeholder="Invite code" autoComplete="off" required />}
      <button className="primary" type="submit">
        {flow === "signIn" ? "Sign in" : "Create account"}
      </button>
      <button type="button" className="link" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
        {flow === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
      {error && <p className="bad">{error}</p>}
    </form>
  );
}

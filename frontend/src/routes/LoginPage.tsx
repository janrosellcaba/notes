import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, getMe, login, register } from "../lib/api";
import { safeNext } from "../lib/dates";
import { queryKeys } from "../lib/queryKeys";
import { BrandMark } from "../components/ui/BrandMark";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const next = safeNext(params.get("next"));
  const me = useQuery({ queryKey: queryKeys.me, queryFn: getMe, retry: false });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (me.data) return <Navigate to={next} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const user = creating ? await register(username, password, code) : await login(username, password);
      queryClient.setQueryData(queryKeys.me, user);
      void navigate(next, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setError("Invalid username or password");
      else if (caught instanceof ApiError && caught.status === 403) setError("Invalid code");
      else if (caught instanceof ApiError && caught.status === 409) setError("That username is taken");
      else if (caught instanceof ApiError && caught.status === 429) setError("Too many attempts. Wait a few minutes.");
      else if (caught instanceof ApiError && caught.status === 422) setError(caught.message);
      else setError("Could not reach the server");
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 text-fg">
      <form
        className="w-full max-w-[360px] rounded-[10px] border border-border bg-elevated p-6"
        onSubmit={(event) => void submit(event)}
      >
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={56} />
          <h1 className="text-[20px]">Notes</h1>
        </div>
        <div className="flex flex-col gap-4">
          <TextField
            label="Username"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            minLength={creating ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {creating ? (
            <TextField
              label="Code"
              name="code"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          ) : null}
        </div>
        {error ? <p className="mt-4 text-priority-urgent">{error}</p> : null}
        <Button type="submit" className="mt-6 w-full" disabled={pending} aria-busy={pending}>
          {creating ? "Create account" : "Continue"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full"
          onClick={() => {
            setCreating((value) => !value);
            setError("");
          }}
        >
          {creating ? "Back to sign in" : "Create account"}
        </Button>
      </form>
    </main>
  );
}

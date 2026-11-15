import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { changePassword, downloadFile, getIntegrations, getSettings, patchContext, patchSettings } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useContexts } from "../lib/queries";
import { useUi } from "../stores/ui";

export function SettingsPage() {
  const contexts = useContexts();
  const settings = useQuery({ queryKey: queryKeys.settings, queryFn: getSettings });
  useQuery({ queryKey: queryKeys.integrations, queryFn: getIntegrations });
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const zone = timezone ?? settings.data?.timezone ?? "";

  async function saveContext(id: string, name: string, color: string, originalName: string, originalColor: string) {
    const nextName = name.trim();
    const nextColor = color.toUpperCase();
    if (!nextName || (nextName === originalName && nextColor === originalColor.toUpperCase())) return;
    try {
      await patchContext(id, { name: nextName, color: nextColor });
      await queryClient.invalidateQueries({ queryKey: queryKeys.contexts });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update the context");
    }
  }

  async function saveTimezone(value = zone) {
    if (!settings.data || value.trim() === settings.data.timezone) return;
    try {
      const saved = await patchSettings({ timezone: value.trim() });
      queryClient.setQueryData(queryKeys.settings, saved);
      setTimezone(null);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update the timezone");
    }
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      pushToast("Use at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      pushToast("The new passwords do not match");
      return;
    }
    setPasswordPending(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      pushToast("Password changed");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not change the password");
    } finally {
      setPasswordPending(false);
    }
  }

  async function download(path: string, fallback: string) {
    try {
      await downloadFile(path, fallback);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Download failed");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <h1 className="text-[20px]">Settings</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] text-fg-muted">Contexts</h2>
        {(contexts.data?.contexts ?? [])
          .slice()
          .sort((left, right) => left.sort_order - right.sort_order)
          .map((context) => (
            <ContextRow key={context.id} id={context.id} name={context.name} color={context.color} slug={context.slug} onSave={saveContext} />
          ))}
      </section>
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-fg-secondary">Timezone</span>
        <input
          value={zone}
          className="min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
          onChange={(event) => setTimezone(event.target.value)}
          onBlur={(event) => void saveTimezone(event.target.value)}
        />
      </label>
      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-[13px] text-fg-muted">Password</h2>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-secondary">Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            className="min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-secondary">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            className="min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-secondary">Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            className="min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="min-h-11 self-start rounded-[8px] bg-fg px-3 text-canvas disabled:opacity-50"
          disabled={passwordPending || !currentPassword || !newPassword || !confirmPassword}
          onClick={() => void savePassword()}
        >
          Change password
        </button>
      </section>
      <section className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-[8px] bg-fg px-3 text-canvas" onClick={() => void download("/api/backup/sqlite", "notes.db")}>
          Download database
        </button>
        <button type="button" className="min-h-11 rounded-[8px] border border-border px-3" onClick={() => void download("/api/backup/json", "notes.json")}>
          Download JSON
        </button>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <StatusCard title="AI provider" />
        <StatusCard title="Google Calendar" />
        <StatusCard title="Microsoft 365" />
      </section>
    </div>
  );
}

function ContextRow({
  id,
  name,
  color,
  slug,
  onSave,
}: {
  id: string;
  name: string;
  color: string;
  slug: string;
  onSave: (id: string, name: string, color: string, originalName: string, originalColor: string) => Promise<void>;
}) {
  const [nextName, setNextName] = useState(name);
  const [nextColor, setNextColor] = useState(color);
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={`${name} color`}
        value={nextColor.toLowerCase()}
        className="h-11 w-11 shrink-0 rounded-[8px] border border-border bg-canvas"
        onChange={(event) => setNextColor(event.target.value)}
        onBlur={(event) => void onSave(id, nextName, event.target.value, name, color)}
      />
      <input
        value={nextName}
        aria-label={`${name} name`}
        className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
        onChange={(event) => setNextName(event.target.value)}
        onBlur={(event) => void onSave(id, event.target.value, nextColor, name, color)}
      />
      <span className="font-mono text-[13px] text-fg-muted">{slug}</span>
    </div>
  );
}

function StatusCard({ title }: { title: string }) {
  return (
    <article className="rounded-[10px] border border-border-subtle bg-elevated p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-[13px] text-fg-muted">Not connected</p>
    </article>
  );
}

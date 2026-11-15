import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../components/ui/Button";
import { changePassword, downloadFile, getIntegrations, getMe, getSettings, patchContext, patchSettings } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useContexts } from "../lib/queries";
import { useUi } from "../stores/ui";

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "preferences", label: "Preferences" },
  { id: "contexts", label: "Contexts" },
  { id: "data", label: "Data" },
  { id: "connections", label: "Connections" },
] as const;

const fieldClass =
  "min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg";

export function SettingsPage() {
  const contexts = useContexts();
  const settings = useQuery({ queryKey: queryKeys.settings, queryFn: getSettings });
  const integrations = useQuery({ queryKey: queryKeys.integrations, queryFn: getIntegrations });
  const me = useQuery({ queryKey: queryKeys.me, queryFn: getMe });
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
  const zone = timezone ?? settings.data?.timezone ?? "";

  useEffect(() => {
    const nodes = SECTIONS.map((section) => document.getElementById(section.id)).filter((node) => node !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-10% 0px -55% 0px", threshold: [0.15, 0.4] },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  async function saveTimezone(value: string) {
    const next = value.trim();
    if (!settings.data || next === settings.data.timezone) return;
    try {
      const saved = await patchSettings({ timezone: next });
      queryClient.setQueryData(queryKeys.settings, saved);
      setTimezone(null);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update the timezone");
    }
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setPasswordError("");
    setPasswordPending(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      pushToast("Password changed");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not change the password");
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

  const rows = (contexts.data?.contexts ?? []).slice().sort((left, right) => left.sort_order - right.sort_order);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="text-[20px]">Settings</h1>
        <p className="mt-1 max-w-xl text-[13px] text-fg-muted">
          Account, preferences, and the data for this workspace.
        </p>
      </header>
      <div className="md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:items-start md:gap-8">
        <nav className="mb-6 flex gap-1 overflow-x-auto md:sticky md:top-0 md:mb-0 md:flex-col" aria-label="Settings sections">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`shrink-0 rounded-[8px] px-3 py-2 text-[13px] hover:bg-interactive hover:text-fg ${
                activeSection === section.id ? "bg-interactive text-fg" : "text-fg-secondary"
              }`}
            >
              {section.label}
            </a>
          ))}
        </nav>
        <div className="flex flex-col gap-6">
          <Panel id="account" title="Account" description="Who is signed in, and the password for this browser.">
            <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-4">
              <div>
                <p className="text-[13px] text-fg-secondary">Signed in as</p>
                <p className="mt-0.5 font-medium">{me.data?.username ?? "…"}</p>
              </div>
            </div>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void savePassword();
              }}
            >
              <div className="sm:col-span-2">
                <Field label="Current password">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    className={fieldClass}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="New password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  className={fieldClass}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  className={fieldClass}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
              <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <p className={passwordError ? "text-[13px] text-priority-urgent" : "text-[13px] text-fg-muted"}>
                  {passwordError || "At least 8 characters. Other sessions for this account are signed out."}
                </p>
                <Button
                  type="submit"
                  disabled={passwordPending || !currentPassword || !newPassword || !confirmPassword}
                  aria-busy={passwordPending}
                >
                  Change password
                </Button>
              </div>
            </form>
          </Panel>

          <Panel id="preferences" title="Preferences" description="How dates and the home feed are calculated.">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="timezone" className="text-[13px] text-fg-secondary">
                Timezone
              </label>
              <select
                id="timezone"
                value={zone}
                className={`${fieldClass} sm:max-w-sm`}
                onChange={(event) => {
                  setTimezone(event.target.value);
                  void saveTimezone(event.target.value);
                }}
              >
                {timeZones(zone).map((group) => (
                  <optgroup key={group.region} label={group.region}>
                    {group.zones.map((name) => (
                      <option key={name} value={name}>
                        {name.replaceAll("_", " ")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </Panel>

          <Panel id="contexts" title="Contexts" description="Names and colors used by projects, tasks, and the inbox.">
            <ul className="flex flex-col">
              {rows.map((context, index) => (
                <li key={context.id} className={index === 0 ? "" : "border-t border-border-subtle pt-3 mt-3"}>
                  <ContextRow
                    id={context.id}
                    name={context.name}
                    color={context.color}
                    slug={context.slug}
                    onSave={saveContext}
                  />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel id="data" title="Data" description="A copy you can keep outside the server. The daily backup on the VPS stays in place.">
            <div className="flex flex-col gap-3">
              <ExportRow
                title="SQLite snapshot"
                detail="A consistent copy of the database, including notes, tasks, and accounts."
                action="Download database"
                onClick={() => void download("/api/backup/sqlite", "notes.db")}
              />
              <ExportRow
                title="JSON export"
                detail="The same records as a file you can open in an editor."
                action="Download JSON"
                onClick={() => void download("/api/backup/json", "notes.json")}
              />
              {settings.data ? (
                <p className="text-[12px] text-fg-muted">Schema version {settings.data.schema_version}</p>
              ) : null}
            </div>
          </Panel>

          <Panel id="connections" title="Connections" description="These stay off until a key is set on the server. Nothing here sends data yet.">
            <div className="flex flex-col">
              <ConnectionRow
                title="AI provider"
                detail={integrations.data?.ai.provider ? integrations.data.ai.provider : "Summaries and action items."}
                configured={integrations.data?.ai.configured ?? false}
              />
              <ConnectionRow
                title="Google Calendar"
                detail="Meetings can be linked to a calendar event."
                configured={integrations.data?.google_calendar.configured ?? false}
              />
              <ConnectionRow
                title="Microsoft 365"
                detail="The same link, through Microsoft Graph."
                configured={integrations.data?.microsoft_calendar.configured ?? false}
              />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-[12px] border border-border bg-elevated">
      <header className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-[15px] font-medium">{title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-fg-muted">{description}</p>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-fg-secondary">{label}</span>
      {children}
    </label>
  );
}

function ExportRow({ title, detail, action, onClick }: { title: string; detail: string; action: string; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-border-subtle bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] text-fg-muted">{detail}</p>
      </div>
      <Button variant="secondary" className="shrink-0" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}

function ConnectionRow({ title, detail, configured }: { title: string; detail: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-subtle py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] text-fg-muted">{detail}</p>
      </div>
      <span className={configured ? "shrink-0 text-[12px] text-status-done" : "shrink-0 text-[12px] text-fg-muted"}>
        {configured ? "Configured" : "Not connected"}
      </span>
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
        className="h-8 w-8 shrink-0 cursor-pointer appearance-none overflow-hidden rounded-full border border-border bg-transparent p-0 [&::-moz-color-swatch]:border-none [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
        onChange={(event) => setNextColor(event.target.value)}
        onBlur={(event) => void onSave(id, nextName, event.target.value, name, color)}
      />
      <input
        value={nextName}
        aria-label={`${name} name`}
        className={`${fieldClass} min-w-0 flex-1`}
        onChange={(event) => setNextName(event.target.value)}
        onBlur={(event) => void onSave(id, event.target.value, nextColor, name, color)}
      />
      <span className="hidden shrink-0 rounded-full bg-canvas px-2 py-1 font-mono text-[12px] text-fg-muted sm:inline">{slug}</span>
    </div>
  );
}

function timeZones(current: string): Array<{ region: string; zones: string[] }> {
  const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Europe/Madrid", "UTC"];
  const names = current && !supported.includes(current) ? [current, ...supported] : supported;
  const groups = new Map<string, string[]>();
  for (const name of names) {
    const region = name.includes("/") ? name.slice(0, name.indexOf("/")) : "Other";
    const list = groups.get(region);
    if (list) list.push(name);
    else groups.set(region, [name]);
  }
  return [...groups.entries()].map(([region, zones]) => ({ region, zones }));
}

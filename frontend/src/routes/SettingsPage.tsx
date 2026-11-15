import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { ContextMark, CONTEXT_ICONS } from "../components/shell/ContextMark";
import { Button } from "../components/ui/Button";
import {
  changePassword,
  createContext,
  deleteContext,
  downloadFile,
  getIntegrations,
  getMe,
  getSettings,
  moveContext,
  patchContext,
  patchSettings,
} from "../lib/api";
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
  const contextId = useUi((state) => state.contextId);
  const setContextId = useUi((state) => state.setContextId);
  const theme = useUi((state) => state.theme);
  const setTheme = useUi((state) => state.setTheme);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [newContext, setNewContext] = useState("");
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

  async function refreshContexts() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.contexts });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    await queryClient.invalidateQueries({ queryKey: ["home"] });
  }

  async function changeIcon(id: string, icon: string) {
    try {
      await patchContext(id, { icon });
      await refreshContexts();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update the icon");
    }
  }

  async function reorder(id: string, direction: "up" | "down") {
    try {
      await moveContext(id, direction);
      await refreshContexts();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not reorder");
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? Its projects have to be gone first.`)) return;
    try {
      await deleteContext(id);
      if (contextId === id) setContextId("all");
      await refreshContexts();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not delete the context");
    }
  }

  async function saveContext(id: string, name: string, color: string, originalName: string, originalColor: string) {
    const nextName = name.trim();
    const nextColor = color.toUpperCase();
    if (!nextName || (nextName === originalName && nextColor === originalColor.toUpperCase())) return;
    try {
      await patchContext(id, { name: nextName, color: nextColor });
      await refreshContexts();
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

          <Panel id="preferences" title="Preferences" description="Appearance, and how dates and the home feed are calculated.">
            <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] text-fg-secondary">Appearance</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">Saved on this browser. Light mode inverts the logo.</p>
              </div>
              <div className="inline-flex rounded-[8px] border border-border bg-canvas p-1" role="radiogroup" aria-label="Appearance">
                {(["dark", "light"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={theme === option}
                    className={`min-h-9 rounded-[6px] px-3 capitalize ${theme === option ? "bg-fg text-canvas" : "text-fg-secondary"}`}
                    onClick={() => setTheme(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

          <Panel id="contexts" title="Contexts" description="Add as many as you need. Each one keeps its own projects, tasks, and inbox.">
            <form
              className="mb-4 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const name = newContext.trim();
                if (!name) return;
                void (async () => {
                  try {
                    await createContext({ name });
                    setNewContext("");
                    await queryClient.invalidateQueries({ queryKey: queryKeys.contexts });
                  } catch (error) {
                    pushToast(error instanceof Error ? error.message : "Could not add the context");
                  }
                })();
              }}
            >
              <input
                value={newContext}
                aria-label="New context name"
                placeholder="New context"
                className={`${fieldClass} min-w-0 flex-1`}
                onChange={(event) => setNewContext(event.target.value)}
              />
              <Button type="submit" className="shrink-0">
                <Plus size={14} />
                Add
              </Button>
            </form>
            <ul className="flex flex-col">
              {rows.map((context, index) => (
                <li key={context.id} className={index === 0 ? "" : "mt-3 border-t border-border-subtle pt-3"}>
                  <ContextRow
                    id={context.id}
                    name={context.name}
                    color={context.color}
                    icon={context.icon}
                    first={index === 0}
                    last={index === rows.length - 1}
                    onSave={saveContext}
                    onIcon={(icon) => void changeIcon(context.id, icon)}
                    onMove={(direction) => void reorder(context.id, direction)}
                    onDelete={() => void remove(context.id, context.name)}
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
  icon,
  first,
  last,
  onSave,
  onIcon,
  onMove,
  onDelete,
}: {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  first: boolean;
  last: boolean;
  onSave: (id: string, name: string, color: string, originalName: string, originalColor: string) => Promise<void>;
  onIcon: (icon: string) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  const [nextName, setNextName] = useState(name);
  const [nextColor, setNextColor] = useState(color);
  const [iconsOpen, setIconsOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button type="button" aria-label={`${name} icon`} onClick={() => setIconsOpen((value) => !value)}>
          <ContextMark icon={icon} color={nextColor} size={28} />
        </button>
        {iconsOpen ? (
          <div className="absolute left-0 z-20 mt-1 grid w-56 grid-cols-7 gap-1 rounded-[10px] border border-border bg-elevated p-2 shadow-[var(--overlay-shadow)]">
            {CONTEXT_ICONS.map((entry) => (
              <button
                key={entry.name}
                type="button"
                aria-label={entry.name}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] hover:bg-interactive"
                onClick={() => {
                  onIcon(entry.name);
                  setIconsOpen(false);
                }}
              >
                <entry.icon size={15} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <label className="relative h-8 w-8 shrink-0">
        <span className="sr-only">{name} color</span>
        <input
          type="color"
          aria-label={`${name} color`}
          value={nextColor.toLowerCase()}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(event) => setNextColor(event.target.value)}
          onBlur={(event) => void onSave(id, nextName, event.target.value, name, color)}
        />
        <span className="block h-8 w-8 rounded-full border border-border" style={{ background: nextColor }} />
      </label>
      <input
        value={nextName}
        aria-label={`${name} name`}
        className={`${fieldClass} min-w-0 flex-1`}
        onChange={(event) => setNextName(event.target.value)}
        onBlur={(event) => void onSave(id, event.target.value, nextColor, name, color)}
      />
      <button type="button" aria-label={`Move ${name} up`} disabled={first} className="text-fg-muted disabled:opacity-30" onClick={() => onMove("up")}>
        <ChevronUp size={16} />
      </button>
      <button type="button" aria-label={`Move ${name} down`} disabled={last} className="text-fg-muted disabled:opacity-30" onClick={() => onMove("down")}>
        <ChevronDown size={16} />
      </button>
      <button type="button" aria-label={`Delete ${name}`} className="text-fg-muted hover:text-fg" onClick={onDelete}>
        <Trash2 size={15} />
      </button>
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

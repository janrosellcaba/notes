import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { ContextMark, CONTEXT_ICONS } from "../components/shell/ContextMark";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import {
  changePassword,
  createContext,
  deleteContext,
  downloadFile,
  getMe,
  getSettings,
  moveContext,
  patchContext,
  patchSettings,
} from "../lib/api";
import { useI18n, type MessageKey } from "../lib/i18n";
import { queryKeys } from "../lib/queryKeys";
import { useContexts } from "../lib/queries";
import { useUi } from "../stores/ui";

const SECTIONS = [
  { id: "account", label: "settings.account" },
  { id: "preferences", label: "settings.preferences" },
  { id: "contexts", label: "settings.contexts" },
  { id: "data", label: "settings.data" },
] as const;

const fieldClass =
  "min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg";

export function SettingsPage() {
  const contexts = useContexts();
  const settings = useQuery({ queryKey: queryKeys.settings, queryFn: getSettings });
  const me = useQuery({ queryKey: queryKeys.me, queryFn: getMe });
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const contextId = useUi((state) => state.contextId);
  const setContextId = useUi((state) => state.setContextId);
  const tasksView = useUi((state) => state.tasksView);
  const setTasksView = useUi((state) => state.setTasksView);
  const boardOrder = useUi((state) => state.boardOrder);
  const moveBoardColumn = useUi((state) => state.moveBoardColumn);
  const { t, locale, setLocale } = useI18n();
  const theme = useUi((state) => state.theme);
  const setTheme = useUi((state) => state.setTheme);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [newContext, setNewContext] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
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
      setPasswordError(t("settings.passwordShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordMismatch"));
      return;
    }
    setPasswordError("");
    setPasswordPending(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      pushToast(t("settings.passwordSaved"));
      setPasswordOpen(false);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t("settings.passwordFailed"));
    } finally {
      setPasswordPending(false);
    }
  }

  async function download(path: string, fallback: string) {
    try {
      await downloadFile(path, fallback);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("settings.downloadFailed"));
    }
  }

  const rows = (contexts.data?.contexts ?? []).slice().sort((left, right) => left.sort_order - right.sort_order);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="text-[20px]">{t("settings.title")}</h1>
        <p className="mt-1 max-w-xl text-[13px] text-fg-muted">{t("settings.lead")}</p>
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
              {t(section.label)}
            </a>
          ))}
        </nav>
        <div className="flex flex-col gap-6">
          <Panel id="account" title={t("settings.account")} description={t("settings.accountDetail")}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] text-fg-secondary">{t("settings.signedIn")}</p>
                <p className="mt-0.5 font-medium">{me.data?.username ?? "…"}</p>
              </div>
              <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
                {t("settings.changePassword")}
              </Button>
            </div>
            {passwordOpen ? (
              <Modal title={t("settings.changePassword")} onClose={() => setPasswordOpen(false)} className="max-w-md">
                <form
                  className="flex flex-col gap-4 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void savePassword();
                  }}
                >
                  <h2 className="text-[16px]">{t("settings.changePassword")}</h2>
                  <Field label={t("settings.current")}>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      className={fieldClass}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </Field>
                  <Field label={t("settings.newPassword")}>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      className={fieldClass}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </Field>
                  <Field label={t("settings.confirm")}>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      className={fieldClass}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </Field>
                  <p className={passwordError ? "text-[13px] text-priority-urgent" : "text-[13px] text-fg-muted"}>
                    {passwordError || t("settings.passwordHint")}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setPasswordOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={passwordPending || !currentPassword || !newPassword || !confirmPassword}
                      aria-busy={passwordPending}
                    >
                      {t("settings.changePassword")}
                    </Button>
                  </div>
                </form>
              </Modal>
            ) : null}
          </Panel>

          <Panel id="preferences" title={t("settings.preferences")} description={t("settings.preferencesDetail")}>
            <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-fg-secondary">{t("settings.appearance")}</p>
              <div className="inline-flex rounded-[8px] border border-border bg-canvas p-1" role="radiogroup" aria-label={t("settings.appearance")}>
                {(["dark", "light"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={theme === option}
                    className={`min-h-8 rounded-[6px] px-3 text-[13px] ${theme === option ? "bg-interactive text-fg" : "text-fg-secondary"}`}
                    onClick={() => setTheme(option)}
                  >
                    {t(option === "dark" ? "settings.dark" : "settings.light")}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] text-fg-secondary">{t("settings.language")}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">{t("settings.languageDetail")}</p>
              </div>
              <div className="inline-flex rounded-[8px] border border-border bg-canvas p-1" role="radiogroup" aria-label={t("settings.language")}>
                {(
                  [
                    ["en", "English"],
                    ["ca", "Català"],
                    ["es", "Español"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={locale === value}
                    className={`min-h-8 rounded-[6px] px-3 text-[13px] ${locale === value ? "bg-interactive text-fg" : "text-fg-secondary"}`}
                    onClick={() => setLocale(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] text-fg-secondary">{t("settings.tasksView")}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">{t("settings.tasksViewDetail")}</p>
              </div>
              <div className="inline-flex rounded-[8px] border border-border bg-canvas p-1" role="radiogroup" aria-label={t("settings.tasksView")}>
                {(["list", "board"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={tasksView === option}
                    className={`min-h-8 rounded-[6px] px-3 text-[13px] ${tasksView === option ? "bg-interactive text-fg" : "text-fg-secondary"}`}
                    onClick={() => setTasksView(option)}
                  >
                    {t(option === "list" ? "tasks.list" : "tasks.board")}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 border-b border-border-subtle pb-4">
              <p className="text-[13px] text-fg-secondary">{t("settings.board")}</p>
              <p className="mt-0.5 text-[13px] text-fg-muted">{t("settings.boardDetail")}</p>
              <ul className="mt-3 flex flex-col">
                {boardOrder.map((status, index) => (
                  <li key={status} className="flex items-center gap-2 border-t border-border-subtle py-2 first:border-t-0">
                    <span className="flex-1 text-[13px]">{t(`board.${status}` as MessageKey)}</span>
                    <button type="button" aria-label={`${status} up`} disabled={index === 0} className="text-fg-muted disabled:opacity-30" onClick={() => moveBoardColumn(status, -1)}>
                      <ChevronUp size={16} />
                    </button>
                    <button type="button" aria-label={`${status} down`} disabled={index === boardOrder.length - 1} className="text-fg-muted disabled:opacity-30" onClick={() => moveBoardColumn(status, 1)}>
                      <ChevronDown size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="timezone" className="text-[13px] text-fg-secondary">
                {t("settings.timezone")}
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

          <Panel id="contexts" title={t("settings.contexts")} description={t("settings.contextsDetail")}>
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

          <Panel id="data" title={t("settings.data")} description={t("settings.dataDetail")}>
            <div className="flex flex-col gap-3">
              <ExportRow
                title={t("settings.sqlite")}
                detail={t("settings.sqliteDetail")}
                action={t("settings.downloadDb")}
                onClick={() => void download("/api/backup/sqlite", "notes.db")}
              />
              <ExportRow
                title={t("settings.json")}
                detail={t("settings.jsonDetail")}
                action={t("settings.downloadJson")}
                onClick={() => void download("/api/backup/json", "notes.json")}
              />
              {settings.data ? (
                <p className="text-[12px] text-fg-muted">{t("settings.schema", { version: String(settings.data.schema_version) })}</p>
              ) : null}
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

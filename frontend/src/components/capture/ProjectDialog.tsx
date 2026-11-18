import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { createProject, errorMessage } from "../../lib/api";
import { FIELD, FIELD_SELECT } from "../../lib/field";
import { useI18n } from "../../lib/i18n";
import { useContexts } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export function ProjectDialog({ contextId, onClose }: { contextId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const activeContext = useUi((state) => state.contextId);
  const contexts = useContexts();
  const { t } = useI18n();
  const listed = contexts.data?.contexts ?? [];
  const fallback =
    activeContext !== "all" && listed.some((context) => context.id === activeContext)
      ? activeContext
      : (listed.find((context) => context.slug === "personal")?.id ?? listed[0]?.id ?? "");
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [chosenContext, setChosenContext] = useState(contextId ?? fallback);
  useEffect(() => {
    if (listed.some((context) => context.id === chosenContext)) return;
    if (fallback) setChosenContext(fallback);
  }, [chosenContext, fallback, listed]);
  const [pending, setPending] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    try {
      const project = await createProject({
        name: trimmed,
        context_id: chosenContext,
        due_on: due || null,
      });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
      void navigate(`/projects/${project.id}`);
    } catch (error) {
      const message = errorMessage(error);
      if (message) pushToast(message);
      setPending(false);
    }
  }

  return (
    <Modal title={t("projects.new")} onClose={onClose} className="max-w-md">
      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 className="text-[16px]">{t("projects.new")}</h2>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-secondary">{t("project.name")}</span>
          <input
            autoFocus
            required
            maxLength={200}
            value={name}
            className={FIELD}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-secondary">{t("project.context")}</span>
          <select
            value={chosenContext}
            className={FIELD_SELECT}
            onChange={(event) => setChosenContext(event.target.value)}
          >
            {listed.map((context) => (
              <option key={context.id} value={context.id}>
                {context.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-secondary">{t("project.due")}</span>
          <input
            type="date"
            value={due}
            className={FIELD}
            onChange={(event) => setDue(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="consult" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="go" disabled={pending || name.trim().length === 0}>
            {t("common.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

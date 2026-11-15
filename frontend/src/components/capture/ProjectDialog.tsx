import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { createProject, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { useContexts } from "../../lib/queries";
import { useUi } from "../../stores/ui";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const ZINC = "#A1A1AA";

export function ProjectDialog({ contextId, onClose }: { contextId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useUi((state) => state.pushToast);
  const activeContext = useUi((state) => state.contextId);
  const contexts = useContexts();
  const listed = contexts.data?.contexts ?? [];
  const fallback =
    activeContext !== "all" && listed.some((context) => context.id === activeContext)
      ? activeContext
      : (listed.find((context) => context.slug === "personal")?.id ?? listed[0]?.id ?? "");
  const [name, setName] = useState("");
  const [chosenContext, setChosenContext] = useState(contextId ?? fallback);
  useEffect(() => {
    if (listed.some((context) => context.id === chosenContext)) return;
    if (fallback) setChosenContext(fallback);
  }, [chosenContext, fallback, listed]);
  const [color, setColor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const swatches = [...(contexts.data?.contexts ?? []).map((context) => context.color), ZINC];

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    try {
      const project = await createProject({ name: trimmed, context_id: chosenContext, color });
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
    <Modal title="New project" onClose={onClose} className="max-w-md">
      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 className="text-[20px]">New project</h2>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-secondary">Name</span>
          <input
            autoFocus
            required
            maxLength={200}
            value={name}
            className="min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-secondary">Context</span>
          <select
            value={chosenContext}
            className="min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg"
            onChange={(event) => setChosenContext(event.target.value)}
          >
            {(contexts.data?.contexts ?? []).map((context) => (
              <option key={context.id} value={context.id}>
                {context.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="mb-1.5 text-[13px] text-fg-secondary">Color</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-label="Use context color"
              className={cn(
                "min-h-11 rounded-full border px-3 text-[13px]",
                color === null ? "border-fg" : "border-border",
              )}
              onClick={() => setColor(null)}
            >
              Context
            </button>
            {swatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                className={cn("h-11 w-11 rounded-full border", color === swatch ? "border-fg" : "border-transparent")}
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
              />
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={pending}>
          Create
        </Button>
      </form>
    </Modal>
  );
}

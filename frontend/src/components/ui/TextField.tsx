import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function TextField({ label, id, className, ...props }: Props) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <label htmlFor={fieldId} className="block">
      <span className="mb-1.5 block text-[13px] text-fg-secondary">{label}</span>
      <input
        id={fieldId}
        className={`min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg ${className ?? ""}`}
        {...props}
      />
    </label>
  );
}

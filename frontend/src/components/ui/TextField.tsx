import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/cn";
import { IconButton } from "./IconButton";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function TextField({ label, id, className, type, ...props }: Props) {
  const generated = useId();
  const fieldId = id ?? generated;
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();

  const input = (
    <input
      id={fieldId}
      type={isPassword ? (visible ? "text" : "password") : type}
      className={cn(
        "min-h-11 w-full rounded-[8px] border border-border bg-canvas px-3 text-[16px] outline-none focus:border-fg",
        isPassword && "pr-11",
        className,
      )}
      {...props}
    />
  );

  if (!isPassword) {
    return (
      <label htmlFor={fieldId} className="block">
        <span className="mb-1.5 block text-[13px] text-fg-secondary">{label}</span>
        {input}
      </label>
    );
  }

  return (
    <div className="block">
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] text-fg-secondary">
        {label}
      </label>
      <div className="relative">
        {input}
        <IconButton
          label={visible ? t("common.hidePassword") : t("common.showPassword")}
          className="absolute right-0.5 top-1/2 h-10 w-10 min-h-10 min-w-10 -translate-y-1/2 text-fg-muted"
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </IconButton>
      </div>
    </div>
  );
}

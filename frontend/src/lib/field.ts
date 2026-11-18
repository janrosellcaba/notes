/** Shared control sizing — keep inputs, selects, and textareas looking identical. */
export const FIELD =
  "min-h-9 w-full rounded-md border border-border bg-canvas px-2.5 py-1.5 text-[13px] outline-none focus:border-fg";

/** Native <select> with room for the custom chevron (see .field-select in CSS). */
export const FIELD_SELECT = `${FIELD} field-select`;

export const FIELD_TEXTAREA =
  "min-h-28 w-full resize-y rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] leading-[1.55] outline-none focus:border-fg";

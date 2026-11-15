export const TASK_FIELDS = ["due", "starts", "priority", "assignee", "project", "subtasks"] as const;

export type TaskField = (typeof TASK_FIELDS)[number];

export type TaskFieldVisibility = Record<TaskField, boolean>;

const KEY = "notes.task.fields";

export function defaultTaskFields(): TaskFieldVisibility {
  return { due: true, starts: true, priority: true, assignee: true, project: true, subtasks: true };
}

export function readTaskFields(): TaskFieldVisibility {
  const fallback = defaultTaskFields();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<TaskFieldVisibility>;
    for (const field of TASK_FIELDS) {
      if (typeof parsed[field] === "boolean") fallback[field] = parsed[field];
    }
    return fallback;
  } catch {
    return defaultTaskFields();
  }
}

export function writeTaskFields(fields: TaskFieldVisibility): void {
  localStorage.setItem(KEY, JSON.stringify(fields));
}

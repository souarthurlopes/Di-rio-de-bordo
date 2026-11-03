export type Field = {
  id: string;
  category?: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "date" | "checklist";
  required?: boolean;
  options?: string[];
};
export type Version = {
  id: string;
  template_id: string;
  company_id: string | null;
  version: number;
  template_name: string;
  description: string;
  frequency: string;
  fields: Field[];
  templates: { name: string };
};
export type Diary = {
  id: string;
  company_id: string;
  unit_id: string;
  author_id: string;
  template_id: string;
  version_id: string;
  period_start: string;
  due_at: string | null;
  status: "draft" | "submitted";
  responses: Record<string, unknown>;
  scheduled: boolean;
};
export function state(
  e: Pick<Diary, "status" | "due_at" | "responses">,
  now = Date.now(),
) {
  if (e.status === "submitted") return "Concluído";
  if (e.due_at && new Date(e.due_at).getTime() < now) return "Atrasado";
  return Object.values(e.responses).some(answered)
    ? "Em andamento"
    : "Pendente";
}
export function answered(x: unknown) {
  return (
    x !== null &&
    x !== undefined &&
    x !== "" &&
    (!Array.isArray(x) || x.length > 0)
  );
}
export const states = ["Pendente", "Em andamento", "Concluído", "Atrasado"];
export function nextPeriod(frequency: string, date: string) {
  const d = new Date(date + "T12:00:00Z");
  if (frequency === "weekly") {
    const n = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - n);
  }
  if (frequency === "monthly") d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

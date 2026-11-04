import type { Field } from "./domain";
import { answered } from "./domain.ts";
export function validateDemo(fields: Field[], values: Record<string, unknown>) {
  for (const f of fields) {
    const v = values[f.id];
    if (f.required && !answered(v)) return "Preencha: " + f.label;
    if (!answered(v)) continue;
    if (f.type === "number" && (typeof v !== "number" || !Number.isFinite(v)))
      return "Número inválido: " + f.label;
    if (f.type === "boolean" && typeof v !== "boolean")
      return "Selecione Sim ou Não: " + f.label;
    if (f.type === "select" && !f.options?.includes(String(v)))
      return "Opção inválida: " + f.label;
    if (
      f.type === "date" &&
      (typeof v !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        Number.isNaN(Date.parse(v + "T12:00Z")))
    )
      return "Data inválida: " + f.label;
  }
  return "";
}

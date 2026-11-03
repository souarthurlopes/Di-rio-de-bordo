export type Cadence = "daily" | "weekly" | "monthly";
export type Company = {
  id: string;
  name: string;
  units: { id: string; name: string }[];
  role: string;
};
export type Template = {
  id: string;
  cadence: Cadence;
  name: string;
  sections: {
    id: string;
    title: string;
    items: { id: string; title: string }[];
  }[];
};
export type Entry = {
  id: string;
  status: "draft" | "submitted";
  details: Record<string, string | number>;
  period_start: string;
  updated_at: string;
};
export const dateLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function periodStart(cadence: Cadence, day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (cadence === "weekly") {
    const weekday = (dt.getDay() + 6) % 7;
    dt.setDate(dt.getDate() - weekday);
  }
  if (cadence === "monthly") dt.setDate(1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

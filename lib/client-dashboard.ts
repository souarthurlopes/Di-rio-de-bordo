export type ClientDiary = {
  id: string;
  clientId: string;
  personId: string;
  personName: string;
  personEmail: string;
  model: { id: string; name: string; frequency: string };
  complete: boolean;
  date: string;
  updatedAt: string;
  completedAt: string | null;
};
export type ClientDiaryFilters = {
  person?: string;
  model?: string;
  status?: string;
  from?: string;
  to?: string;
};
export function clientDiaries(
  records: ClientDiary[],
  clientId: string,
  filters: ClientDiaryFilters = {},
) {
  return records
    .filter((r) => {
      if (r.clientId !== clientId) return false;
      if (filters.person && r.personId !== filters.person) return false;
      if (filters.model && r.model.id !== filters.model) return false;
      if (filters.status === "completed" && !r.complete) return false;
      if (filters.status === "draft" && r.complete) return false;
      const day = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(r.completedAt || r.updatedAt));
      return (
        (!filters.from || day >= filters.from) &&
        (!filters.to || day <= filters.to)
      );
    })
    .sort(
      (a, b) =>
        Date.parse(b.completedAt || b.updatedAt) -
        Date.parse(a.completedAt || a.updatedAt),
    );
}

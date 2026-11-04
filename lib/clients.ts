export type ClientPerson = {
  id: string;
  name: string;
  email: string;
  role: "leader" | "employee";
  unit: string;
};
export type Client = { id: string; name: string; people: ClientPerson[] };
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
export function validateClient(name: string, people: ClientPerson[]) {
  if (name.trim().length < 2) return "Informe o nome do cliente.";
  if (!people.length) return "Adicione pelo menos uma pessoa responsável.";
  const emails = new Set<string>();
  for (const p of people) {
    if (!p.name.trim()) return "Informe o nome de cada pessoa.";
    const email = normalizeEmail(p.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Informe um e-mail válido para cada pessoa.";
    if (emails.has(email)) return "Há e-mails repetidos neste cliente.";
    emails.add(email);
  }
  return "";
}

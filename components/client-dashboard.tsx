"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Users,
} from "lucide-react";
import type { Client } from "../lib/clients";
import {
  clientDiaries,
  type ClientDiary,
  type ClientDiaryFilters,
} from "../lib/client-dashboard";
export function ClientDashboard({
  clients,
  clientId,
  records,
  onSelect,
  onOpen,
  onClients,
  onNew,
}: {
  clients: Client[];
  clientId: string;
  records: ClientDiary[];
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onClients: () => void;
  onNew: (id: string) => void;
}) {
  const [filters, setFilters] = useState<ClientDiaryFilters>({});
  const client = clients.find((c) => c.id === clientId);
  if (!client)
    return (
      <section className="card stack">
        <h2>Selecione um cliente</h2>
        <p className="muted">
          Cadastre um cliente para acompanhar seus diários e responsáveis.
        </p>
        <button className="btn" onClick={onClients}>
          Ir para Clientes
        </button>
      </section>
    );
  const all = clientDiaries(records, client.id),
    filtered = clientDiaries(records, client.id, filters);
  const people = [
    ...new Map([
      ...client.people.map(
        (p) => [p.id, { name: p.name, email: p.email }] as const,
      ),
      ...all.map(
        (r) =>
          [r.personId, { name: r.personName, email: r.personEmail }] as const,
      ),
    ]).entries(),
  ];
  const models = [
    ...new Map(all.map((r) => [r.model.id, r.model.name])).entries(),
  ];
  function filter(key: keyof ClientDiaryFilters, value: string) {
    setFilters((a) => ({ ...a, [key]: value }));
  }
  return (
    <div className="stack">
      <div className="client-dashboard-toolbar">
        <button className="text-action" onClick={onClients}>
          <ArrowLeft size={14} /> Clientes
        </button>
        <label className="field">
          Cliente
          <select
            className="input"
            aria-label="Cliente"
            value={client.id}
            onChange={(e) => {
              setFilters({});
              onSelect(e.target.value);
            }}
          >
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="client-dashboard-heading">
        <div>
          <span className="section-kicker">ACOMPANHAMENTO DO CLIENTE</span>
          <h2>{client.name}</h2>
          <p>
            Diários preenchidos e as pessoas responsáveis por cada registro.
          </p>
        </div>
        <button className="btn" onClick={() => onNew(client.id)}>
          Preencher diário <ArrowRight size={14} />
        </button>
      </section>
      <div className="overview-stats">
        {[
          [BookOpen, "Diários registrados", all.length],
          [CheckCircle2, "Concluídos", all.filter((r) => r.complete).length],
          [ClipboardCheck, "Rascunhos", all.filter((r) => !r.complete).length],
          [
            Users,
            "Pessoas que preencheram",
            new Set(all.map((r) => r.personId)).size,
          ],
        ].map(([Icon, label, count]) => {
          const I = Icon as typeof BookOpen;
          return (
            <article key={String(label)}>
              <div>
                <span>{String(label)}</span>
                <I size={16} />
              </div>
              <strong>{Number(count)}</strong>
              <small>Somente este cliente</small>
            </article>
          );
        })}
      </div>
      <section className="overview-panel">
        <div className="overview-panel-heading">
          <h2>Diários e responsáveis</h2>
          <span className="badge">{filtered.length} registro(s)</span>
        </div>
        <div className="client-dashboard-filters">
          <label className="field">
            Preenchido por
            <select
              className="input"
              aria-label="Preenchido por"
              value={filters.person || ""}
              onChange={(e) => filter("person", e.target.value)}
            >
              <option value="">Todas as pessoas</option>
              {people.map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name} · {p.email}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Questionário
            <select
              className="input"
              aria-label="Questionário"
              value={filters.model || ""}
              onChange={(e) => filter("model", e.target.value)}
            >
              <option value="">Todos</option>
              {models.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Situação
            <select
              className="input"
              aria-label="Situação"
              value={filters.status || ""}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">Todas</option>
              <option value="completed">Concluídos</option>
              <option value="draft">Rascunhos</option>
            </select>
          </label>
          <label className="field">
            De
            <input
              className="input"
              type="date"
              value={filters.from || ""}
              onChange={(e) => filter("from", e.target.value)}
            />
          </label>
          <label className="field">
            Até
            <input
              className="input"
              type="date"
              value={filters.to || ""}
              onChange={(e) => filter("to", e.target.value)}
            />
          </label>
          <button className="text-action" onClick={() => setFilters({})}>
            Limpar filtros
          </button>
        </div>
        {filters.from && filters.to && filters.from > filters.to ? (
          <div className="flow-error" role="alert">
            A data inicial deve ser anterior ou igual à data final.
          </div>
        ) : filtered.length ? (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Diário de bordo</th>
                  <th>Preenchido por</th>
                  <th>Concluído / atualizado em</th>
                  <th>Situação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.model.name}</td>
                    <td>
                      <strong>{r.personName}</strong>
                      <small className="person-email">{r.personEmail}</small>
                    </td>
                    <td>
                      {new Date(r.completedAt || r.updatedAt).toLocaleString(
                        "pt-BR",
                      )}
                    </td>
                    <td>
                      <span className="badge gray">
                        {r.complete ? "Concluído" : "Rascunho"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-action"
                        onClick={() => onOpen(r.id)}
                      >
                        Consultar diário <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="calm-empty">
            <span>
              <BookOpen size={24} />
            </span>
            <h3>
              {all.length
                ? "Nenhum diário para estes filtros"
                : "Este cliente ainda não tem diários preenchidos"}
            </h3>
            <p>
              {all.length
                ? "Ajuste os filtros para consultar os registros."
                : "Quando um diário for preenchido, ele aparecerá aqui com o nome e o e-mail de quem o preencheu."}
            </p>
          </div>
        )}
      </section>
      <p className="muted client-dashboard-note">
        Os indicadores mostram todos os registros deste cliente na sessão. Os
        filtros afetam a lista abaixo. Dados temporários da demonstração; não há
        compartilhamento nem controle real de acesso.
      </p>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "../lib/types";
import { Diary, state, states } from "../lib/domain";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
type Member = { company_id: string; user_id: string; role: string };
export function Dashboard({
  db,
  companies,
  onOpen,
  revision,
}: {
  db: SupabaseClient;
  companies: Company[];
  onOpen: (company: string, entry: string) => void;
  revision: number;
}) {
  const [entries, setEntries] = useState<Diary[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [names, setNames] = useState<Record<string, string>>({}),
    [incidents, setIncidents] = useState(0),
    [plans, setPlans] = useState(0);
  const [company, setCompany] = useState(""),
    [unit, setUnit] = useState(""),
    [leader, setLeader] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [status, setStatus] = useState(""),
    [model, setModel] = useState(""),
    [models, setModels] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const ids = companies.map((c) => c.id);
        const requests = await Promise.all([
          db
            .from("entries")
            .select("*")
            .in("company_id", ids)
            .order("period_start", { ascending: false })
            .limit(1000),
          db.from("memberships").select("*").in("company_id", ids),
          db.from("profiles").select("id,display_name"),
          db
            .from("incidents")
            .select("id", { count: "exact", head: true })
            .in("company_id", ids)
            .eq("status", "open"),
          db
            .from("action_plans")
            .select("id", { count: "exact", head: true })
            .in("company_id", ids)
            .eq("status", "open"),
          db.from("templates").select("id,name"),
        ]);
        for (const r of requests) if (r.error) throw Error(r.error.message);
        if (active) {
          setEntries((requests[0].data ?? []) as Diary[]);
          setMembers((requests[1].data ?? []) as Member[]);
          setNames(
            Object.fromEntries(
              (requests[2].data ?? []).map((p) => [p.id, p.display_name]),
            ),
          );
          setIncidents(requests[3].count ?? 0);
          setPlans(requests[4].count ?? 0);
          setModels(requests[5].data ?? []);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, companies, revision]);
  const filtered = entries.filter(
    (e) =>
      (!company || e.company_id === company) &&
      (!unit || e.unit_id === unit) &&
      (!leader || e.author_id === leader) &&
      (!status || state(e) === status) &&
      (!from || e.period_start >= from) &&
      (!to || e.period_start <= to) &&
      (!model || e.template_id === model),
  );
  const latest = filtered.filter(
    (e, i, a) =>
      a.findIndex(
        (x) =>
          x.company_id === e.company_id &&
          x.unit_id === e.unit_id &&
          x.author_id === e.author_id,
      ) === i,
  );
  const selectedCompanies = companies.filter(
    (c) => !company || c.id === company,
  );
  if (loading)
    return (
      <div className="card" role="status">
        Carregando painel…
      </div>
    );
  return (
    <div className="stack">
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <section className="card fields">
        <label className="field">
          Empresa
          <select
            className="input"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setUnit("");
              setLeader("");
            }}
          >
            <option value="">Todas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Unidade
          <select
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Todas</option>
            {selectedCompanies.flatMap((c) =>
              c.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {c.name} · {u.name}
                </option>
              )),
            )}
          </select>
        </label>
        <label className="field">
          Líder
          <select
            className="input"
            value={leader}
            onChange={(e) => setLeader(e.target.value)}
          >
            <option value="">Todos</option>
            {members
              .filter(
                (m) =>
                  m.role === "member" && (!company || m.company_id === company),
              )
              .map((m) => (
                <option key={m.company_id + m.user_id} value={m.user_id}>
                  {names[m.user_id] ?? m.user_id.slice(0, 8)}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Situação
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todas</option>
            {states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Modelo
          <select
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">Todos</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          De
          <input
            className="input"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          Até
          <input
            className="input"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </section>
      <div className="stats four">
        {[
          ["Empresas", selectedCompanies.length],
          [
            "Unidades",
            selectedCompanies.reduce((a, c) => a + c.units.length, 0),
          ],
          [
            "Líderes",
            new Set(
              members
                .filter(
                  (m) =>
                    m.role === "member" &&
                    (!company || m.company_id === company),
                )
                .map((m) => m.user_id),
            ).size,
          ],
          [
            "Diários concluídos",
            filtered.filter((e) => e.status === "submitted").length,
          ],
          [
            "Diários pendentes",
            filtered.filter((e) => e.status !== "submitted").length,
          ],
          [
            "Registros atrasados",
            filtered.filter((e) => state(e) === "Atrasado").length,
          ],
          ["Ocorrências abertas", incidents],
          ["Planos em andamento", plans],
        ].map(([l, v]) => (
          <div className="card" key={l}>
            <div className="muted">{l}</div>
            <div className="number">{v}</div>
          </div>
        ))}
      </div>
      <p className="muted tiny">
        Diários: até 1.000 registros recentes autorizados, filtrados acima.
        Empresas, unidades e líderes seguem o filtro de empresa. Ocorrências e
        planos: todo o escopo autorizado. Registros históricos sem prazo não são
        classificados como atrasados.
      </p>
      <section className="card stack">
        <h2>Últimos registros por líder e unidade</h2>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                {[
                  "Empresa",
                  "Unidade",
                  "Líder",
                  "Último diário",
                  "Situação",
                  "Ação",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latest.map((e) => (
                <tr key={e.id}>
                  <td>{companies.find((c) => c.id === e.company_id)?.name}</td>
                  <td>
                    {
                      companies
                        .flatMap((c) => c.units)
                        .find((u) => u.id === e.unit_id)?.name
                    }
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => setLeader(e.author_id)}
                    >
                      {names[e.author_id] ?? e.author_id.slice(0, 8)}
                    </button>
                  </td>
                  <td>{e.period_start}</td>
                  <td>
                    <span className="badge">{state(e)}</span>
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => onOpen(e.company_id, e.id)}
                    >
                      Consultar registros
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              Nenhum registro para os filtros selecionados.
            </div>
          )}
        </div>
      </section>
      <section className="card stack">
        <h2>Relatório de preenchimento</h2>
        <p>
          Taxa de conclusão:{" "}
          {filtered.length
            ? Math.round(
                (filtered.filter((e) => e.status === "submitted").length /
                  filtered.length) *
                  100,
              ) + "%"
            : "sem registros"}
          .
        </p>
        {filtered.length ? (
          <div
            style={{ height: 260, minWidth: 0 }}
            role="img"
            aria-label="Quantidade de diários por situação"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={states.map((s) => ({
                  name: s,
                  total: filtered.filter((e) => state(e) === s).length,
                }))}
              >
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#507c79" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty">
            Os gráficos aparecerão quando houver registros.
          </div>
        )}
        <p className="muted tiny">
          A taxa considera registros existentes, incluindo atribuições
          pendentes. PDF previsto para uma próxima versão.
        </p>
      </section>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "../lib/types";
import { IndicatorChart } from "./indicator-chart";
import type { Version } from "../lib/domain";
type Incident = {
  id: string;
  unit_id: string;
  description: string;
  priority: string;
  deadline: string;
  status: string;
  solution: string;
  notes: string;
  responsible_id: string;
};
type Plan = {
  id: string;
  description: string;
  deadline: string;
  status: string;
};
type Indicator = {
  id: string;
  unit_id: string;
  name: string;
  value: number;
  measured_at: string;
};
type Person = { user_id: string; name: string };
export function Operations({
  db,
  company,
  user,
}: {
  db: SupabaseClient;
  company: Company;
  user: string;
}) {
  const [people, setPeople] = useState<Person[]>([]),
    [versions, setVersions] = useState<Version[]>([]),
    [incidents, setIncidents] = useState<Incident[]>([]),
    [plans, setPlans] = useState<Plan[]>([]),
    [indicators, setIndicators] = useState<Indicator[]>([]),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const admin = company.role !== "member";
  useEffect(() => {
    let active = true;
    (async () => {
      const rs = await Promise.all([
        db
          .from("memberships")
          .select("user_id")
          .eq("company_id", company.id)
          .eq("role", "member"),
        db
          .from("template_versions")
          .select("*,templates(name)")
          .or("company_id.is.null,company_id.eq." + company.id)
          .order("version", { ascending: false }),
        db.from("incidents").select("*").eq("company_id", company.id),
        db.from("action_plans").select("*").eq("company_id", company.id),
        db
          .from("indicators")
          .select("*")
          .eq("company_id", company.id)
          .order("measured_at"),
        db.from("profiles").select("id,display_name"),
      ]);
      if (!active) return;
      const err = rs.find((r) => r.error)?.error;
      if (err) {
        setMessage(err.message);
        return;
      }
      setPeople(
        (rs[0].data ?? []).map((m) => ({
          user_id: m.user_id,
          name:
            rs[5].data?.find((p) => p.id === m.user_id)?.display_name ??
            m.user_id.slice(0, 8),
        })),
      );
      setVersions(rs[1].data ?? []);
      setIncidents(rs[2].data ?? []);
      setPlans(rs[3].data ?? []);
      setIndicators(rs[4].data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [db, company.id, revision]);
  async function run(f: FormData) {
    setBusy(true);
    setMessage("");
    const s = (k: string) => String(f.get(k) ?? "");
    try {
      let error;
      if (s("op") === "assign")
        ({ error } = await db.rpc("assign_diary", {
          target_company: company.id,
          target_unit: s("unit_id"),
          target_user: s("responsible_id"),
          target_version: s("version_id"),
          target_period: s("period_start"),
          deadline: s("deadline") + "-03:00",
        }));
      if (s("op") === "incident")
        ({ error } = await db.from("incidents").insert({
          company_id: company.id,
          unit_id: s("unit_id"),
          responsible_id: admin ? s("responsible_id") : user,
          description: s("description"),
          priority: s("priority"),
          deadline: s("deadline"),
          notes: s("notes"),
        }));
      if (s("op") === "resolve")
        ({ error } = await db
          .from("incidents")
          .update({ status: "resolved", solution: s("solution") })
          .eq("id", s("id"))
          .eq("company_id", company.id));
      if (s("op") === "plan")
        ({ error } = await db.from("action_plans").insert({
          company_id: company.id,
          description: s("description"),
          deadline: s("deadline"),
        }));
      if (s("op") === "done")
        ({ error } = await db
          .from("action_plans")
          .update({ status: "completed" })
          .eq("id", s("id"))
          .eq("company_id", company.id));
      if (s("op") === "indicator")
        ({ error } = await db.from("indicators").insert({
          company_id: company.id,
          unit_id: s("unit_id"),
          name: s("name"),
          value: Number(s("value")),
          measured_at: s("measured_at"),
        }));
      if (error) throw Error(error.message);
      setMessage("Operação concluída.");
      setRevision((n) => n + 1);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const units = (
    <label className="field">
      Unidade
      <select name="unit_id" required className="input">
        {company.units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
  const persons = (
    <label className="field">
      Responsável
      <select name="responsible_id" required className="input">
        {people.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  const submit = (op: string) => (
    <>
      <input type="hidden" name="op" value={op} />
      <button className="btn" disabled={busy}>
        Salvar
      </button>
    </>
  );
  return (
    <div className="stack">
      {message && (
        <div role="status" className="alert">
          {message}
        </div>
      )}
      {admin && (
        <section className="card stack">
          <h2>Atribuir diário</h2>
          <p className="muted">
            Cada atribuição representa uma obrigação prevista. Os períodos e
            prazos são definidos explicitamente nesta versão. Horários abaixo no
            fuso de Brasília (UTC−03).
          </p>
          <form action={run} className="stack">
            <div className="fields">
              {units}
              {persons}
              <label className="field">
                Modelo / versão
                <select className="input" required name="version_id">
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.template_name} · v{v.version}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Início do período
                <input
                  required
                  className="input"
                  name="period_start"
                  type="date"
                />
              </label>
              <label className="field">
                Prazo (Brasília)
                <input
                  required
                  className="input"
                  type="datetime-local"
                  name="deadline"
                />
              </label>
            </div>
            {submit("assign")}
          </form>
        </section>
      )}
      <section className="card stack">
        <h2>Ocorrências</h2>
        <form action={run} className="stack">
          <div className="fields">
            {units}
            {admin && persons}
            <label className="field">
              Problema
              <textarea required className="input" name="description" />
            </label>
            <label className="field">
              Prioridade
              <select className="input" name="priority">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </label>
            <label className="field">
              Prazo
              <input className="input" type="date" required name="deadline" />
            </label>
            <label className="field">
              Observações
              <textarea className="input" name="notes" />
            </label>
          </div>
          {submit("incident")}
        </form>
        {incidents.map((i) => (
          <div className="card stack" key={i.id}>
            <h3>
              {i.description}{" "}
              <span className="badge">
                {i.status === "open" ? "Aberta" : "Resolvida"}
              </span>
            </h3>
            <p>
              {company.units.find((u) => u.id === i.unit_id)?.name} ·{" "}
              {i.priority} · Prazo {i.deadline}
            </p>
            <p>
              {i.notes} {i.solution}
            </p>
            {admin && i.status === "open" && (
              <form action={run} className="row">
                <input type="hidden" name="id" value={i.id} />
                <label className="field">
                  Solução adotada
                  <input className="input" name="solution" required />
                </label>
                {submit("resolve")}
              </form>
            )}
          </div>
        ))}
        {!incidents.length && (
          <div className="empty">Nenhuma ocorrência registrada.</div>
        )}
      </section>
      {admin && (
        <section className="card stack">
          <h2>Planos de ação</h2>
          <form action={run} className="row">
            <label className="field">
              Descrição
              <input className="input" name="description" required />
            </label>
            <label className="field">
              Prazo
              <input className="input" name="deadline" type="date" required />
            </label>
            {submit("plan")}
          </form>
          {plans.map((p) => (
            <form key={p.id} action={run} className="row">
              <p>
                {p.description} · {p.deadline} ·{" "}
                {p.status === "open" ? "Em andamento" : "Concluído"}
              </p>
              <input name="id" type="hidden" value={p.id} />
              {p.status === "open" && submit("done")}
            </form>
          ))}
        </section>
      )}
      <section className="card stack">
        <h2>Indicadores</h2>
        {admin && (
          <form action={run} className="fields">
            {units}
            <label className="field">
              Indicador
              <input required className="input" name="name" />
            </label>
            <label className="field">
              Valor
              <input
                required
                className="input"
                type="number"
                step="any"
                name="value"
              />
            </label>
            <label className="field">
              Data
              <input
                required
                className="input"
                name="measured_at"
                type="date"
              />
            </label>
            {submit("indicator")}
          </form>
        )}
        <IndicatorChart points={indicators} units={company.units} />
        {indicators.map((i) => (
          <p key={i.id}>
            {i.measured_at} · {i.name}: {i.value}
          </p>
        ))}
        {!indicators.length && (
          <div className="empty">Nenhum indicador cadastrado.</div>
        )}
      </section>
    </div>
  );
}

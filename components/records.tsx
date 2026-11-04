"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "../lib/types";
import { Diary, Version, answered, state, nextPeriod } from "../lib/domain";
export function Records({
  db,
  company,
  user,
  onChange,
  initialEntry = "",
  initialLeader = "",
}: {
  db: SupabaseClient;
  company: Company;
  user: string;
  onChange: () => void;
  initialEntry?: string;
  initialLeader?: string;
}) {
  const [versions, setVersions] = useState<Version[]>([]),
    [entries, setEntries] = useState<Diary[]>([]),
    [selected, setSelected] = useState<Diary | null>(null);
  const [vid, setVid] = useState(""),
    [unit, setUnit] = useState(company.units[0]?.id ?? ""),
    [period, setPeriod] = useState(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date()),
    );
  const [saved, setSaved] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelected(null);
    setValues({});
    setUnit(company.units[0]?.id ?? "");
    (async () => {
      try {
        const [a, b] = await Promise.all([
          db
            .from("template_versions")
            .select("*,templates(name)")
            .or("company_id.is.null,company_id.eq." + company.id)
            .order("version", { ascending: false }),
          db
            .from("entries")
            .select("*")
            .eq("company_id", company.id)
            .order("period_start", { ascending: false })
            .limit(500),
        ]);
        if (a.error || b.error) throw a.error || b.error;
        if (alive) {
          setVersions(a.data ?? []);
          setEntries(b.data ?? []);
          setVid(a.data?.[0]?.id ?? "");
          const requested = b.data?.find((e) => e.id === initialEntry);
          if (requested) {
            setSelected(requested);
            const fields = (a.data?.find((v) => v.id === requested.version_id)
              ?.fields ?? []) as import("../lib/domain").Field[];
            setValues(
              Object.fromEntries(
                Object.entries(requested.responses).map(([key, value]) => [
                  key,
                  fields.find((f) => f.id === key)?.type === "number" &&
                  value !== "" &&
                  value !== null
                    ? Number(value)
                    : value,
                ]),
              ),
            );
          }
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, company.id, company.units, revision, initialEntry]);
  const version = versions.find((v) => v.id === (selected?.version_id ?? vid));
  const readonly =
    selected &&
    (selected.author_id !== user || selected.status === "submitted");
  function open(e: Diary) {
    setSelected(e);
    const fields = versions.find((v) => v.id === e.version_id)?.fields ?? [];
    setValues(
      Object.fromEntries(
        Object.entries(e.responses).map(([key, value]) => [
          key,
          fields.find((f) => f.id === key)?.type === "number" &&
          value !== "" &&
          value !== null
            ? Number(value)
            : value,
        ]),
      ),
    );
    setError("");
  }
  async function save(finalize: boolean) {
    if (!version) return;
    setBusy(true);
    setError("");
    try {
      const p = selected?.period_start ?? nextPeriod(version.frequency, period);
      const existing =
        selected ??
        entries.find(
          (e) =>
            e.author_id === user &&
            e.unit_id === unit &&
            e.template_id === version.template_id &&
            e.period_start === p,
        );
      if (existing && !selected) {
        open(existing);
        throw Error(
          "Já existe um diário neste período. Ele foi aberto para consulta ou continuação.",
        );
      }
      const { error } = await db.rpc("save_diary", {
        target_entry: selected?.id ?? null,
        target_company: company.id,
        target_unit: selected?.unit_id ?? unit,
        target_version: version.id,
        target_period: p,
        payload: values,
        finalize,
      });
      if (error) throw Error(error.message);
      setSaved(
        finalize
          ? "Diário finalizado e preservado no histórico."
          : "Rascunho salvo. Abra o registro para continuar.",
      );
      setRevision((n) => n + 1);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="card" role="status">
        Carregando modelos e registros…
      </div>
    );
  return (
    <div className="stack">
      <section className="card stack">
        <h2>Registros e preenchimento</h2>
        <p className="muted">
          Os modelos de diário de bordo permanecem disponíveis. A lista inclui
          até 500 registros autorizados da empresa selecionada.
        </p>
        {saved && (
          <div className="alert" role="status">
            {saved}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Unidade</th>
                <th>Líder</th>
                <th>Período</th>
                <th>Situação</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {entries
                .filter((e) => !initialLeader || e.author_id === initialLeader)
                .map((e) => (
                  <tr key={e.id}>
                    <td>
                      {versions.find((v) => v.id === e.version_id)?.templates
                        .name ?? "Modelo"}{" "}
                      · v{versions.find((v) => v.id === e.version_id)?.version}
                    </td>
                    <td>
                      {company.units.find((u) => u.id === e.unit_id)?.name}
                    </td>
                    <td>
                      {e.author_id === user ? "Você" : e.author_id.slice(0, 8)}
                    </td>
                    <td>{e.period_start}</td>
                    <td>{state(e)}</td>
                    <td>
                      <button className="btn secondary" onClick={() => open(e)}>
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!entries.length && (
            <div className="empty">Nenhum diário registrado.</div>
          )}
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            setSelected(null);
            setValues({});
            setError("");
          }}
        >
          Iniciar novo diário
        </button>
        {!selected && (
          <div className="fields">
            <label className="field">
              Modelo / versão
              <select
                className="input"
                value={vid}
                onChange={(e) => {
                  setVid(e.target.value);
                  setValues({});
                }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.template_name} · v{v.version} · {v.frequency}
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
                {company.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Data de referência
              <input
                className="input"
                type="date"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </label>
          </div>
        )}
      </section>
      {version ? (
        <section className="card stack">
          <h2>
            {version.template_name} · versão {version.version}
          </h2>
          <p>{version.description}</p>
          <p className="muted">
            Progresso:{" "}
            {version.fields.filter((f) => answered(values[f.id])).length}/
            {version.fields.length} respostas ·{" "}
            {selected?.due_at
              ? "Prazo: " + new Date(selected.due_at).toLocaleString("pt-BR")
              : "Sem prazo atribuído"}
          </p>
          <div className="progress">
            <div
              className="bar"
              style={{
                width:
                  (version.fields.length
                    ? (100 *
                        version.fields.filter((f) => answered(values[f.id]))
                          .length) /
                      version.fields.length
                    : 0) + "%",
              }}
            />
          </div>
          <fieldset
            disabled={Boolean(readonly) || busy}
            className="stack"
            style={{ border: 0, padding: 0 }}
          >
            {version.fields.map((f) => (
              <label className="field" key={f.id}>
                <span className="muted tiny">
                  {f.category || "Indicadores e observações"}
                </span>
                <strong>
                  {f.label}
                  {f.required ? " *" : ""}
                </strong>
                {f.type === "select" || f.type === "boolean" ? (
                  <select
                    className="input"
                    value={
                      values[f.id] === undefined || values[f.id] === null
                        ? ""
                        : String(values[f.id])
                    }
                    onChange={(e) =>
                      setValues((a) => ({
                        ...a,
                        [f.id]:
                          e.target.value === ""
                            ? null
                            : f.type === "boolean"
                              ? e.target.value === "true"
                              : e.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    {(f.type === "boolean"
                      ? ["true", "false"]
                      : (f.options ?? [])
                    ).map((o) => (
                      <option key={o} value={o}>
                        {f.type === "boolean"
                          ? o === "true"
                            ? "Sim"
                            : "Não"
                          : o}
                      </option>
                    ))}
                  </select>
                ) : f.type === "checklist" ? (
                  <div className="row">
                    {f.options?.map((o) => (
                      <span key={o}>
                        <input
                          type="checkbox"
                          checked={
                            Array.isArray(values[f.id]) &&
                            (values[f.id] as string[]).includes(o)
                          }
                          onChange={(e) =>
                            setValues((a) => ({
                              ...a,
                              [f.id]: e.target.checked
                                ? [
                                    ...(Array.isArray(a[f.id])
                                      ? (a[f.id] as string[])
                                      : []),
                                    o,
                                  ]
                                : (a[f.id] as string[]).filter((x) => x !== o),
                            }))
                          }
                        />{" "}
                        {o}
                      </span>
                    ))}
                  </div>
                ) : f.type === "text" ? (
                  <textarea
                    className="input"
                    rows={3}
                    value={String(values[f.id] ?? "")}
                    onChange={(e) =>
                      setValues((a) => ({ ...a, [f.id]: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    className="input"
                    type={f.type}
                    step={f.type === "number" ? "any" : undefined}
                    value={String(values[f.id] ?? "")}
                    onChange={(e) =>
                      setValues((a) => ({
                        ...a,
                        [f.id]:
                          e.target.value === ""
                            ? null
                            : f.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                      }))
                    }
                  />
                )}
              </label>
            ))}
          </fieldset>
          {readonly ? (
            <div className="alert">
              Consulta de registro preservado. Somente o autor pode editar
              rascunhos.
            </div>
          ) : (
            <div className="row">
              <button
                className="btn secondary"
                disabled={busy || !unit || !period}
                onClick={() => void save(false)}
              >
                Salvar rascunho
              </button>
              <button
                className="btn"
                disabled={busy || !unit || !period}
                onClick={() => void save(true)}
              >
                Finalizar registro
              </button>
            </div>
          )}
        </section>
      ) : (
        <div className="card empty">
          Nenhum modelo disponível. Aplique as migrations e o seed.
        </div>
      )}
    </div>
  );
}

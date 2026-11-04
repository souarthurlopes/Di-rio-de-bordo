"use client";
import { useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Building2,
  Users,
  ClipboardCheck,
  Plus,
  TriangleAlert,
  FlaskConical,
} from "lucide-react";
import originals from "../lib/demo-versions.json";
import { answered, type Field } from "../lib/domain";
import { validateDemo } from "../lib/demo";
type Model = { id: string; name: string; frequency: string; fields: Field[] };
type RecordItem = {
  id: string;
  model: Model;
  values: Record<string, unknown>;
  complete: boolean;
  date: string;
};
type Company = { id: string; name: string; units: string[] };
type Incident = {
  id: string;
  description: string;
  priority: string;
  deadline: string;
  resolved: boolean;
};
const baseModels: Model[] = originals.map((v) => ({
  id: v.id,
  name: v.template_name,
  frequency: v.frequency,
  fields: v.fields as Field[],
}));
const screens = [
  { id: "dashboard", name: "Visão geral", icon: LayoutDashboard },
  { id: "diary", name: "Preencher diário", icon: ClipboardCheck },
  { id: "history", name: "Histórico temporário", icon: BookOpen },
  { id: "companies", name: "Empresas e unidades", icon: Building2 },
  { id: "team", name: "Líderes", icon: Users },
  { id: "models", name: "Modelos de diário", icon: Plus },
  { id: "incidents", name: "Ocorrências", icon: TriangleAlert },
];
export default function DemoApp() {
  const [view, setView] = useState("dashboard"),
    [companies, setCompanies] = useState<Company[]>([]),
    [people, setPeople] = useState<
      { name: string; company: string; unit: string }[]
    >([]),
    [models, setModels] = useState(baseModels),
    [records, setRecords] = useState<RecordItem[]>([]),
    [incidents, setIncidents] = useState<Incident[]>([]);
  const [modelId, setModelId] = useState(baseModels[0].id),
    [values, setValues] = useState<Record<string, unknown>>({}),
    [recordId, setRecordId] = useState(""),
    [message, setMessage] = useState("");
  const [fields, setFields] = useState<Field[]>([]),
    [modelName, setModelName] = useState(""),
    [frequency, setFrequency] = useState("daily");
  const model = models.find((m) => m.id === modelId) ?? models[0],
    current = records.find((r) => r.id === recordId),
    locked = Boolean(current?.complete);
  function go(id: string) {
    setView(id);
    setMessage("");
  }
  function start() {
    setRecordId("");
    setValues({});
    go("diary");
  }
  function save(complete: boolean) {
    if (locked) return;
    const err = complete ? validateDemo(model.fields, values) : "";
    if (err) {
      setMessage(err);
      return;
    }
    const id = recordId || crypto.randomUUID();
    const item = {
      id,
      model: structuredClone(model),
      values: structuredClone(values),
      complete,
      date: new Date().toLocaleString("pt-BR"),
    };
    setRecords((a) => [item, ...a.filter((r) => r.id !== id)]);
    setRecordId(id);
    setMessage(
      complete
        ? "Diário finalizado nesta demonstração. Ele permanece apenas nesta aba."
        : "Rascunho temporário salvo nesta aba.",
    );
  }
  function open(r: RecordItem) {
    setModelId(r.model.id);
    setRecordId(r.id);
    setValues(structuredClone(r.values));
    go("diary");
  }
  function updateField(i: number, p: Partial<Field>) {
    setFields((a) => a.map((f, j) => (i === j ? { ...f, ...p } : f)));
  }
  const activeModel = current?.model ?? model;
  return (
    <div className="page">
      <aside className="sidebar">
        <div className="logo">
          Bordo<span>GESTÃO DE EQUIPES</span>
        </div>
        <nav className="stack">
          {screens.map((s) => (
            <button
              key={s.id}
              className={"navitem " + (view === s.id ? "active" : "")}
              onClick={() => go(s.id)}
            >
              <s.icon size={18} />
              <span className="navtext">{s.name}</span>
            </button>
          ))}
        </nav>
        <div className="sidefooter">
          Demonstração sem banco
          <br />
          Sem login · sem sincronização
        </div>
      </aside>
      <main className="main">
        <div className="demo-banner">
          <FlaskConical size={19} />
          <span>
            <strong>MODO DEMONSTRAÇÃO</strong> · Todos os dados são temporários
            e ficam apenas na memória desta aba. Ao atualizar ou fechar a
            página, eles serão apagados. Use somente informações de teste.
          </span>
        </div>
        <header className="top">
          <div>
            <div className="eyebrow">DIÁRIO DE BORDO</div>
            <h1>{screens.find((s) => s.id === view)?.name}</h1>
            <p className="muted">
              Explore as rotinas de acompanhamento sem precisar configurar um
              banco.
            </p>
          </div>
          <span className="badge gray">Dados de demonstração</span>
        </header>
        {message && (
          <div className="alert" role="status">
            {message}
          </div>
        )}
        {view === "dashboard" && (
          <div className="stack">
            <div className="stats four">
              {[
                ["Empresas temporárias", companies.length],
                [
                  "Unidades temporárias",
                  companies.reduce((a, c) => a + c.units.length, 0),
                ],
                ["Líderes de teste", people.length],
                [
                  "Diários finalizados",
                  records.filter((r) => r.complete).length,
                ],
                [
                  "Rascunhos temporários",
                  records.filter((r) => !r.complete).length,
                ],
                [
                  "Ocorrências abertas",
                  incidents.filter((i) => !i.resolved).length,
                ],
              ].map(([l, v]) => (
                <div className="card" key={l}>
                  <div className="muted">{l}</div>
                  <div className="number">{v}</div>
                </div>
              ))}
            </div>
            <section className="card stack">
              <h2>Experimente o Diário de Bordo</h2>
              <p>
                Os três modelos originais da VELO estão disponíveis como
                referência. Você pode preencher, guardar um rascunho nesta aba e
                simular a finalização.
              </p>
              <div className="row">
                <button className="btn" onClick={start}>
                  Preencher um diário
                </button>
                <button className="btn secondary" onClick={() => go("models")}>
                  Criar modelo de teste
                </button>
              </div>
            </section>
            <section className="card stack">
              <h2>Registros desta sessão</h2>
              {records.length ? (
                records.map((r) => (
                  <div key={r.id} className="row spread">
                    <span>
                      {r.model.name} ·{" "}
                      {r.complete ? "Concluído" : "Em andamento"}
                    </span>
                    <button className="btn secondary" onClick={() => open(r)}>
                      Consultar
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">
                  Nenhum diário preenchido nesta demonstração.
                </div>
              )}
            </section>
          </div>
        )}
        {view === "diary" && (
          <div className="stack">
            <section className="card stack">
              <div className="row spread">
                <h2>{activeModel.name}</h2>
                <button className="btn secondary" onClick={start}>
                  Novo preenchimento
                </button>
              </div>
              {!recordId && (
                <label className="field">
                  Modelo
                  <select
                    className="input"
                    value={modelId}
                    onChange={(e) => {
                      setModelId(e.target.value);
                      setValues({});
                    }}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="muted">
                Progresso:{" "}
                {
                  activeModel.fields.filter((f) => answered(values[f.id]))
                    .length
                }
                /{activeModel.fields.length} respostas ·{" "}
                {locked
                  ? "Finalizado nesta sessão"
                  : "Preenchimento temporário"}
              </p>
              <div className="progress">
                <div
                  className="bar"
                  style={{
                    width:
                      (activeModel.fields.length
                        ? (100 *
                            activeModel.fields.filter((f) =>
                              answered(values[f.id]),
                            ).length) /
                          activeModel.fields.length
                        : 0) + "%",
                  }}
                />
              </div>
            </section>
            <section className="card stack">
              <fieldset disabled={locked} className="demo-fields">
                {activeModel.fields.map((f) => (
                  <label className="field" key={f.id}>
                    <span className="muted tiny">{f.category}</span>
                    <strong>
                      {f.label}
                      {f.required ? " *" : ""}
                    </strong>
                    {f.type === "boolean" || f.type === "select" ? (
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
                                    : (a[f.id] as string[]).filter(
                                        (v) => v !== o,
                                      ),
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
              {locked ? (
                <p>
                  Registro finalizado na demonstração. Inicie outro
                  preenchimento para testar novamente.
                </p>
              ) : (
                <div className="row">
                  <button className="btn secondary" onClick={() => save(false)}>
                    Guardar rascunho temporário
                  </button>
                  <button className="btn" onClick={() => save(true)}>
                    Simular finalização
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
        {view === "history" && (
          <section className="card stack">
            <h2>Histórico desta aba</h2>
            <p className="muted">
              Nenhum registro é enviado para um servidor ou recuperado após
              atualizar a página.
            </p>
            {records.map((r) => (
              <div className="row spread" key={r.id}>
                <p>
                  {r.model.name} · {r.date} ·{" "}
                  {r.complete ? "Concluído" : "Rascunho"}
                </p>
                <button className="btn secondary" onClick={() => open(r)}>
                  Abrir
                </button>
              </div>
            ))}
            {!records.length && (
              <div className="empty">Nenhum registro nesta sessão.</div>
            )}
          </section>
        )}
        {view === "companies" && (
          <div className="stack">
            <section className="card stack">
              <h2>Adicionar empresa de teste</h2>
              <form
                className="row"
                action={(f) => {
                  setCompanies((a) => [
                    ...a,
                    {
                      id: crypto.randomUUID(),
                      name: String(f.get("name")).trim(),
                      units: [],
                    },
                  ]);
                  setMessage("Empresa adicionada apenas nesta sessão.");
                }}
              >
                <label className="field">
                  Nome
                  <input name="name" required minLength={2} className="input" />
                </label>
                <button className="btn">Adicionar temporariamente</button>
              </form>
            </section>
            {companies.map((c) => (
              <section className="card stack" key={c.id}>
                <h2>{c.name}</h2>
                <p>{c.units.join(" · ") || "Nenhuma unidade de teste."}</p>
                <form
                  className="row"
                  action={(f) =>
                    setCompanies((a) =>
                      a.map((x) =>
                        x.id === c.id
                          ? {
                              ...x,
                              units: [...x.units, String(f.get("unit")).trim()],
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <label className="field">
                    Nova unidade
                    <input className="input" required name="unit" />
                  </label>
                  <button className="btn secondary">Adicionar unidade</button>
                </form>
              </section>
            ))}
            {!companies.length && (
              <div className="card empty">
                Nenhuma empresa adicionada nesta demonstração.
              </div>
            )}
          </div>
        )}
        {view === "team" && (
          <section className="card stack">
            <h2>Simular cadastro de líder</h2>
            <p className="muted">
              Nenhum convite ou e-mail será enviado. Não há autenticação nem
              isolamento entre usuários nesta demonstração.
            </p>
            <form
              className="fields"
              action={(f) => {
                setPeople((a) => [
                  ...a,
                  {
                    name: String(f.get("name")),
                    company: String(f.get("company")),
                    unit: String(f.get("unit")),
                  },
                ]);
                setMessage("Líder de teste adicionado nesta aba.");
              }}
            >
              <label className="field">
                Nome de teste
                <input className="input" required name="name" />
              </label>
              <label className="field">
                Empresa (opcional)
                <input className="input" name="company" />
              </label>
              <label className="field">
                Unidade (opcional)
                <input className="input" name="unit" />
              </label>
              <button className="btn">Simular cadastro</button>
            </form>
            {people.map((p, i) => (
              <p key={i}>
                {p.name} · {p.company || "Sem empresa"} ·{" "}
                {p.unit || "Sem unidade"}
              </p>
            ))}
          </section>
        )}
        {view === "models" && (
          <section className="card stack">
            <h2>Criar modelo temporário</h2>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!fields.length) return;
                const m = {
                  id: crypto.randomUUID(),
                  name: modelName.trim(),
                  frequency,
                  fields: structuredClone(fields),
                };
                setModels((a) => [...a, m]);
                setModelId(m.id);
                setRecordId("");
                setValues({});
                setMessage(
                  "Modelo criado apenas nesta sessão. Abra Preencher diário para testar.",
                );
                setFields([]);
                setModelName("");
              }}
            >
              <div className="fields">
                <label className="field">
                  Nome
                  <input
                    required
                    minLength={2}
                    className="input"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                </label>
                <label className="field">
                  Frequência
                  <select
                    className="input"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                  >
                    {["daily", "weekly", "monthly", "custom"].map((v, i) => (
                      <option key={v} value={v}>
                        {["Diária", "Semanal", "Mensal", "Personalizada"][i]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {fields.map((f, i) => (
                <div className="card stack" key={f.id}>
                  <div className="fields">
                    <label className="field">
                      Categoria
                      <input
                        required
                        className="input"
                        value={f.category}
                        onChange={(e) =>
                          updateField(i, { category: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Pergunta
                      <input
                        required
                        className="input"
                        value={f.label}
                        onChange={(e) =>
                          updateField(i, { label: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Tipo
                      <select
                        className="input"
                        value={f.type}
                        onChange={(e) =>
                          updateField(i, {
                            type: e.target.value as Field["type"],
                          })
                        }
                      >
                        {[
                          "text",
                          "boolean",
                          "number",
                          "date",
                          "select",
                          "checklist",
                        ].map((v, j) => (
                          <option key={v} value={v}>
                            {
                              [
                                "Texto / observações",
                                "Sim/Não",
                                "Número",
                                "Data",
                                "Seleção",
                                "Checklist",
                              ][j]
                            }
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {["select", "checklist"].includes(f.type) && (
                    <label className="field">
                      Opções (uma por linha)
                      <textarea
                        className="input"
                        required
                        value={f.options?.join("\n") ?? ""}
                        onChange={(e) =>
                          updateField(i, {
                            options: e.target.value.split("\n"),
                          })
                        }
                      />
                    </label>
                  )}
                  <div className="row">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(f.required)}
                        onChange={(e) =>
                          updateField(i, { required: e.target.checked })
                        }
                      />{" "}
                      Obrigatória
                    </label>
                    <button
                      className="btn secondary"
                      type="button"
                      disabled={!i}
                      onClick={() =>
                        setFields((a) => {
                          const b = [...a];
                          [b[i - 1], b[i]] = [b[i], b[i - 1]];
                          return b;
                        })
                      }
                    >
                      Subir
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() =>
                        setFields((a) => a.filter((x) => x.id !== f.id))
                      }
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              <div className="row">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() =>
                    setFields((a) => [
                      ...a,
                      {
                        id: crypto.randomUUID(),
                        category: "",
                        label: "",
                        type: "text",
                        required: false,
                        options: [],
                      },
                    ])
                  }
                >
                  Adicionar pergunta
                </button>
                <button className="btn" disabled={!fields.length}>
                  Criar modelo de teste
                </button>
              </div>
            </form>
          </section>
        )}
        {view === "incidents" && (
          <section className="card stack">
            <h2>Simular ocorrência</h2>
            <form
              className="fields"
              action={(f) =>
                setIncidents((a) => [
                  ...a,
                  {
                    id: crypto.randomUUID(),
                    description: String(f.get("description")),
                    priority: String(f.get("priority")),
                    deadline: String(f.get("deadline")),
                    resolved: false,
                  },
                ])
              }
            >
              <label className="field">
                Descrição
                <input required className="input" name="description" />
              </label>
              <label className="field">
                Prioridade
                <select className="input" name="priority">
                  <option>Baixa</option>
                  <option>Média</option>
                  <option>Alta</option>
                </select>
              </label>
              <label className="field">
                Prazo
                <input type="date" className="input" required name="deadline" />
              </label>
              <button className="btn">Adicionar temporariamente</button>
            </form>
            {incidents.map((i) => (
              <div key={i.id} className="row spread">
                <p>
                  {i.description} · {i.priority} · {i.deadline} ·{" "}
                  {i.resolved ? "Resolvida" : "Aberta"}
                </p>
                {!i.resolved && (
                  <button
                    className="btn secondary"
                    onClick={() =>
                      setIncidents((a) =>
                        a.map((x) =>
                          x.id === i.id ? { ...x, resolved: true } : x,
                        ),
                      )
                    }
                  >
                    Simular resolução
                  </button>
                )}
              </div>
            ))}
          </section>
        )}
        <footer className="footertext">
          Demonstração sem banco de dados · Nenhum dado real deve ser inserido ·
          Os dados desaparecem ao recarregar.
        </footer>
      </main>
    </div>
  );
}

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
  ArrowRight,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import originals from "../lib/demo-versions.json";
import { type Field } from "../lib/domain";
import { DiaryFlow } from "./diary-flow";
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
  { id: "diary", name: "Diários de bordo", icon: ClipboardCheck },
  { id: "history", name: "Registros", icon: BookOpen },
  { id: "companies", name: "Empresas e unidades", icon: Building2 },
  { id: "team", name: "Líderes", icon: Users },
  { id: "models", name: "Modelos de diário", icon: Plus },
  { id: "incidents", name: "Ocorrências", icon: TriangleAlert },
];
export default function DemoApp() {
  const [flowKey, setFlowKey] = useState(0);
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
    setFlowKey((n) => n + 1);
    setRecordId("");
    setValues({});
    go("diary");
  }
  function save(complete: boolean) {
    if (locked) return;
    const err = complete ? validateDemo(model.fields, values) : "";
    if (err) {
      setMessage(err);
      return err;
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
    setFlowKey((n) => n + 1);
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
    <div className="page bordo-redesign">
      <aside className="sidebar">
        <div className="logo">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          <div>
            Diário de Bordo<small>GESTÃO E ACOMPANHAMENTO</small>
          </div>
        </div>
        <div className="nav-section-label">ESPAÇO DE GESTÃO</div>
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
        <div className="bordo-topbar">
          <span>
            Meu espaço <ChevronRight size={13} />{" "}
            <strong>{screens.find((s) => s.id === view)?.name}</strong>
          </span>
          <span className="topbar-profile">
            <span>G</span> Visão da gestora
          </span>
        </div>
        <div className="bordo-content">
          <div className="demo-banner">
            <FlaskConical size={14} />
            <span>
              Modo demonstração · Os dados desta sessão são apagados ao
              recarregar a página.
            </span>
          </div>
          <header className="top">
            <div>
              <div className="eyebrow">DIÁRIO DE BORDO</div>
              <h1>{screens.find((s) => s.id === view)?.name}</h1>
              <p className="muted">
                {view === "diary"
                  ? "Uma categoria por vez. Mais clareza para registrar sua rotina."
                  : "Uma visão clara das suas equipes, rotinas e próximos passos."}
              </p>
            </div>
            {view !== "diary" && (
              <button className="btn" onClick={start}>
                <Plus size={16} /> Preencher diário
              </button>
            )}
          </header>
          {message && (
            <div className="alert" role="status">
              {message}
            </div>
          )}
          {view === "dashboard" && (
            <div className="dashboard-layout">
              <section className="bordo-hero">
                <div>
                  <span className="section-kicker">
                    ACOMPANHAR É CUIDAR DO QUE IMPORTA
                  </span>
                  <h2>
                    Mais clareza para liderar.
                    <br />
                    Mais espaço para evoluir.
                  </h2>
                  <p>
                    Reúna a rotina, perceba os desafios e transforme registros
                    em próximos passos.
                  </p>
                  <button className="btn" onClick={start}>
                    Começar um diário <ArrowRight size={16} />
                  </button>
                </div>
                <BookOpen className="hero-book" size={100} strokeWidth={0.7} />
              </section>
              <div className="overview-stats">
                {[
                  [Building2, "Empresas", companies.length, "No seu espaço"],
                  [Users, "Líderes", people.length, "Adicionados nesta sessão"],
                  [
                    CheckCircle2,
                    "Concluídos",
                    records.filter((r) => r.complete).length,
                    "Diários finalizados",
                  ],
                  [
                    ClipboardCheck,
                    "Em andamento",
                    records.filter((r) => !r.complete).length,
                    "Rascunhos para continuar",
                  ],
                ].map(([Icon, label, n, hint]) => {
                  const I = Icon as typeof Building2;
                  return (
                    <article key={String(label)}>
                      <div>
                        <span>{String(label)}</span>
                        <I size={17} />
                      </div>
                      <strong>{Number(n)}</strong>
                      <small>{String(hint)}</small>
                    </article>
                  );
                })}
              </div>
              <div className="dashboard-columns">
                <section className="overview-panel">
                  <div className="overview-panel-heading">
                    <h2>Seus próximos passos</h2>
                    <span className="badge gray">Nesta sessão</span>
                  </div>
                  {records.some((r) => !r.complete) ? (
                    records
                      .filter((r) => !r.complete)
                      .map((r) => (
                        <button
                          className="next-step"
                          key={r.id}
                          onClick={() => open(r)}
                        >
                          <span className="next-step-icon">
                            <ClipboardCheck size={20} />
                          </span>
                          <span>
                            <strong>Continuar diário</strong>
                            <small>{r.model.name.replace("VELO • ", "")}</small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                      ))
                  ) : (
                    <div className="calm-empty">
                      <span>
                        <CheckCircle2 size={26} />
                      </span>
                      <h3>Um novo ponto de partida</h3>
                      <p>
                        Comece seu primeiro diário. Seus rascunhos aparecerão
                        aqui para você continuar de onde parou.
                      </p>
                      <button className="btn secondary" onClick={start}>
                        Preencher meu primeiro diário <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </section>
                <section className="overview-panel">
                  <div className="overview-panel-heading">
                    <h2>Seu espaço de gestão</h2>
                  </div>
                  {[
                    [
                      Building2,
                      "Empresas e unidades",
                      "Organize quem você acompanha.",
                      "companies",
                    ],
                    [Users, "Líderes", "Tenha sua equipe por perto.", "team"],
                    [
                      TriangleAlert,
                      "Ocorrências",
                      incidents.filter((i) => !i.resolved).length +
                        " abertas nesta sessão.",
                      "incidents",
                    ],
                  ].map(([Icon, title, description, target]) => {
                    const I = Icon as typeof Building2;
                    return (
                      <button
                        className="next-step"
                        key={String(target)}
                        onClick={() => go(String(target))}
                      >
                        <span className="next-step-icon">
                          <I size={19} />
                        </span>
                        <span>
                          <strong>{String(title)}</strong>
                          <small>{String(description)}</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    );
                  })}
                </section>
              </div>
              <section className="overview-panel">
                <div className="overview-panel-heading">
                  <h2>Últimos registros</h2>
                  <button onClick={() => go("history")}>
                    Ver todos <ArrowRight size={14} />
                  </button>
                </div>
                {records.length ? (
                  <div className="tablewrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Diário</th>
                          <th>Atualizado em</th>
                          <th>Situação</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.slice(0, 5).map((r) => (
                          <tr key={r.id}>
                            <td>{r.model.name.replace("VELO • ", "")}</td>
                            <td>{r.date}</td>
                            <td>
                              <span className="badge gray">
                                {r.complete ? "Concluído" : "Em andamento"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="text-action"
                                onClick={() => open(r)}
                              >
                                Consultar <ArrowRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="calm-empty compact">
                    <BookOpen size={22} />
                    <p>
                      Seus registros aparecerão aqui após o primeiro
                      preenchimento.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
          {view === "diary" && (
            <DiaryFlow
              key={flowKey}
              models={models}
              model={activeModel}
              values={values}
              locked={locked}
              existing={Boolean(recordId)}
              onChoose={(id) => {
                setModelId(id);
                setValues({});
                setRecordId("");
              }}
              onChange={(id, value) =>
                setValues((a) => ({ ...a, [id]: value }))
              }
              onSave={save}
              onNew={start}
            />
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
                <h2>Cadastrar empresa</h2>
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
                    <input
                      name="name"
                      required
                      minLength={2}
                      className="input"
                    />
                  </label>
                  <button className="btn">Adicionar</button>
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
                                units: [
                                  ...x.units,
                                  String(f.get("unit")).trim(),
                                ],
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
                  Nenhuma empresa cadastrada nesta sessão.
                </div>
              )}
            </div>
          )}
          {view === "team" && (
            <section className="card stack">
              <h2>Cadastrar líder</h2>
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
                  Nome
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
                <button className="btn">Adicionar líder</button>
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
              <h2>Criar modelo de diário</h2>
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
                    Criar modelo
                  </button>
                </div>
              </form>
            </section>
          )}
          {view === "incidents" && (
            <section className="card stack">
              <h2>Registrar ocorrência</h2>
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
                  <input
                    type="date"
                    className="input"
                    required
                    name="deadline"
                  />
                </label>
                <button className="btn">Adicionar</button>
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
                      Marcar como resolvida
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
          <footer className="footertext">
            Demonstração sem banco de dados · Nenhum dado real deve ser inserido
            · Os dados desaparecem ao recarregar.
          </footer>
        </div>
      </main>
    </div>
  );
}

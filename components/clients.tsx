"use client";
import { useState } from "react";
import { Building2, Plus, Trash2, Mail, ArrowRight } from "lucide-react";
import {
  normalizeEmail,
  validateClient,
  type Client,
  type ClientPerson,
} from "../lib/clients";
function person(): ClientPerson {
  return {
    id: crypto.randomUUID(),
    name: "",
    email: "",
    role: "leader",
    unit: "",
  };
}
export function Clients({
  clients,
  onSave,
  onDiary,
}: {
  clients: Client[];
  onSave: (client: Client) => void;
  onDiary: (client: Client) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null),
    [name, setName] = useState(""),
    [people, setPeople] = useState<ClientPerson[]>([]),
    [message, setMessage] = useState("");
  function create() {
    setEditing("");
    setName("");
    setPeople([person()]);
    setMessage("");
  }
  function update(id: string, patch: Partial<ClientPerson>) {
    setPeople((a) => a.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  return (
    <div className="stack">
      <section className="overview-panel">
        <div className="overview-panel-heading">
          <h2>Clientes e pessoas responsáveis</h2>
          <button className="btn" onClick={create}>
            <Plus size={14} /> Novo cliente
          </button>
        </div>
        {clients.length ? (
          clients.map((c) => (
            <article className="client-summary" key={c.id}>
              <div className="row spread">
                <div className="row">
                  <span className="next-step-icon">
                    <Building2 size={20} />
                  </span>
                  <div>
                    <h3>{c.name}</h3>
                    <p>{c.people.length} pessoa(s) vinculada(s)</p>
                  </div>
                </div>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setEditing(c.id);
                    setName(c.name);
                    setPeople(structuredClone(c.people));
                    setMessage("");
                  }}
                >
                  Editar cadastro
                </button>
              </div>
              <div className="client-people">
                {c.people.map((p) => (
                  <div key={p.id}>
                    <strong>{p.name}</strong>
                    <span>
                      {p.role === "leader" ? "Líder" : "Funcionário"}
                      {p.unit ? " · " + p.unit : ""}
                    </span>
                    <small>
                      <Mail size={12} />
                      {p.email}
                    </small>
                  </div>
                ))}
              </div>
              <button className="text-action" onClick={() => onDiary(c)}>
                Vincular diário a uma pessoa <ArrowRight size={14} />
              </button>
            </article>
          ))
        ) : (
          <div className="calm-empty">
            <span>
              <Building2 size={24} />
            </span>
            <h3>Cadastre seu primeiro cliente</h3>
            <p>
              No mesmo cadastro, adicione os líderes e funcionários que
              preencherão os diários.
            </p>
            <button className="btn secondary" onClick={create}>
              Cadastrar cliente
            </button>
          </div>
        )}
      </section>
      {editing !== null && (
        <section className="card stack">
          <div>
            <span className="section-kicker">UM ÚNICO CADASTRO</span>
            <h2>{editing ? "Editar cliente" : "Novo cliente"}</h2>
          </div>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const error = validateClient(name, people);
              if (error) {
                setMessage(error);
                return;
              }
              onSave({
                id: editing || crypto.randomUUID(),
                name: name.trim(),
                people: people.map((p) => ({
                  ...p,
                  name: p.name.trim(),
                  email: normalizeEmail(p.email),
                  unit: p.unit.trim(),
                })),
              });
              setEditing(null);
            }}
          >
            <label className="field">
              Nome do cliente / empresa
              <input
                required
                minLength={2}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div>
              <h3>Pessoas que preencherão os diários</h3>
              <p className="muted">
                Informe o e-mail da própria pessoa. Ele ficará vinculado aos
                registros atribuídos a ela.
              </p>
            </div>
            {people.map((p, i) => (
              <fieldset className="client-person-form" key={p.id}>
                <legend>Pessoa {i + 1}</legend>
                <div className="fields">
                  <label className="field">
                    Nome
                    <input
                      required
                      className="input"
                      value={p.name}
                      onChange={(e) => update(p.id, { name: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    E-mail de acesso
                    <input
                      required
                      type="email"
                      className="input"
                      autoComplete="off"
                      value={p.email}
                      onChange={(e) => update(p.id, { email: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    Função
                    <select
                      className="input"
                      value={p.role}
                      onChange={(e) =>
                        update(p.id, {
                          role: e.target.value as ClientPerson["role"],
                        })
                      }
                    >
                      <option value="leader">Líder</option>
                      <option value="employee">Funcionário</option>
                    </select>
                  </label>
                  <label className="field">
                    Unidade / equipe (opcional)
                    <input
                      className="input"
                      value={p.unit}
                      onChange={(e) => update(p.id, { unit: e.target.value })}
                    />
                  </label>
                </div>
                <button
                  className="text-action"
                  type="button"
                  onClick={() =>
                    setPeople((a) => a.filter((x) => x.id !== p.id))
                  }
                >
                  <Trash2 size={13} /> Remover pessoa
                </button>
              </fieldset>
            ))}
            <button
              className="btn secondary"
              type="button"
              onClick={() => setPeople((a) => [...a, person()])}
            >
              <Plus size={14} /> Adicionar pessoa
            </button>
            {message && (
              <div className="flow-error" role="alert">
                {message}
              </div>
            )}
            <p className="muted">
              Demonstração: o cadastro fica apenas nesta aba. Nenhuma conta ou
              convite de acesso é criado.
            </p>
            <div className="row">
              <button className="btn">Salvar cliente e pessoas</button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Field, Version } from "../lib/domain";
export function Builder({
  db,
  company,
}: {
  db: SupabaseClient;
  company: string;
}) {
  const [fields, setFields] = useState<Field[]>([]),
    [versions, setVersions] = useState<Version[]>([]),
    [target, setTarget] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [frequency, setFrequency] = useState("daily"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setTarget("");
    setFields([]);
    setName("");
    setDescription("");
    setFrequency("daily");
    db.from("template_versions")
      .select("*,templates(name)")
      .or("company_id.is.null,company_id.eq." + company)
      .order("version", { ascending: false })
      .then(({ data, error }) => {
        if (active) {
          if (error) setMessage(error.message);
          else setVersions(data ?? []);
        }
      });
    return () => {
      active = false;
    };
  }, [db, company, revision]);
  function load(id: string, copy: boolean) {
    const v = versions.find((v) => v.id === id);
    if (!v) return;
    setTarget(copy ? "" : v.template_id);
    setName(copy ? v.template_name + " (cópia)" : v.template_name);
    setDescription(v.description);
    setFrequency(v.frequency);
    setFields(
      v.fields.map((f) => ({
        ...f,
        category: f.category || "Indicadores e observações",
        required: Boolean(f.required),
        options: f.options ?? [],
      })),
    );
  }
  function update(i: number, patch: Partial<Field>) {
    setFields((a) => a.map((f, j) => (i === j ? { ...f, ...patch } : f)));
  }
  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await db.rpc("publish_template", {
        target_company: company,
        target_template: target || null,
        template_name: name,
        template_description: description,
        frequency,
        questions: fields,
      });
      if (error) throw Error(error.message);
      setMessage("Versão publicada. Os registros antigos foram preservados.");
      setRevision((n) => n + 1);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card stack">
      <h2>Construtor de modelos</h2>
      <p className="muted">
        Carregue uma versão para editar. Modelos de referência são copiados para
        a empresa. A publicação cria uma nova versão, sem alterar respostas
        anteriores.
      </p>
      <label className="field">
        Carregar versão
        <select
          className="input"
          defaultValue=""
          onChange={(e) => {
            const v = versions.find((v) => v.id === e.target.value);
            if (v) load(v.id, v.company_id === null);
          }}
        >
          <option value="">Selecione</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.template_name} · v{v.version}
              {v.company_id === null ? " · copiar referência" : ""}
            </option>
          ))}
        </select>
      </label>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void publish();
        }}
      >
        <div className="fields">
          <label className="field">
            Nome
            <input
              required
              minLength={2}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            Frequência
            <select
              className="input"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {[
                ["daily", "Diária"],
                ["weekly", "Semanal"],
                ["monthly", "Mensal"],
                ["custom", "Personalizada"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          Descrição
          <textarea
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {fields.map((f, i) => (
          <div className="card stack" key={f.id}>
            <div className="fields">
              <label className="field">
                Categoria
                <input
                  required
                  className="input"
                  value={f.category ?? ""}
                  onChange={(e) => update(i, { category: e.target.value })}
                />
              </label>
              <label className="field">
                Pergunta
                <input
                  required
                  className="input"
                  value={f.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </label>
              <label className="field">
                Tipo
                <select
                  className="input"
                  value={f.type}
                  onChange={(e) =>
                    update(i, { type: e.target.value as Field["type"] })
                  }
                >
                  {[
                    ["text", "Texto / observações"],
                    ["boolean", "Sim / Não"],
                    ["number", "Número"],
                    ["date", "Data"],
                    ["select", "Seleção"],
                    ["checklist", "Checklist"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {["select", "checklist"].includes(f.type) && (
                <label className="field">
                  Opções (uma por linha)
                  <textarea
                    required
                    className="input"
                    value={f.options?.join("\n") ?? ""}
                    onChange={(e) =>
                      update(i, { options: e.target.value.split("\n") })
                    }
                  />
                </label>
              )}
            </div>
            <div className="row">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(f.required)}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />{" "}
                Obrigatória
              </label>
              <button
                className="btn secondary"
                type="button"
                disabled={i === 0}
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
                onClick={() => setFields((a) => a.filter((x) => x.id !== f.id))}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
        <p className="muted tiny">
          A ordem das perguntas define a sequência das categorias. Mova cada
          pergunta para organizar os blocos.
        </p>
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
          <button disabled={busy || !fields.length} className="btn">
            Publicar versão
          </button>
        </div>
        {message && (
          <div className="alert" role="status">
            {message}
          </div>
        )}
      </form>
    </section>
  );
}

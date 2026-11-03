"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "../lib/types";
type Invite = {
  token: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
};
export function TeamAccess({
  db,
  company,
  onChange,
}: {
  db: SupabaseClient;
  company: Company;
  onChange: () => void;
}) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]),
    [invitations, setInvitations] = useState<Invite[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      const [a, b, c] = await Promise.all([
        db
          .from("memberships")
          .select("user_id")
          .eq("company_id", company.id)
          .eq("role", "member"),
        db.from("profiles").select("id,display_name"),
        db
          .from("invitations")
          .select("token,email,role,expires_at,accepted_at")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      const error = a.error || b.error || c.error;
      if (error) {
        setMessage(error.message);
        return;
      }
      setPeople(
        (a.data ?? []).map((m) => ({
          id: m.user_id,
          name:
            b.data?.find((p) => p.id === m.user_id)?.display_name ??
            m.user_id.slice(0, 8),
        })),
      );
      setInvitations(c.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [db, company.id, revision]);
  async function update(f: FormData) {
    setBusy(true);
    const { error } = await db.rpc("manage_unit_access", {
      target_company: company.id,
      target_unit: String(f.get("unit")),
      target_user: String(f.get("person")),
      allow: f.get("allow") === "yes",
    });
    setBusy(false);
    setMessage(error ? error.message : "Permissão atualizada.");
    if (!error) {
      setRevision((n) => n + 1);
      onChange();
    }
  }
  async function revoke(token: string) {
    setBusy(true);
    const { error } = await db.rpc("revoke_invitation", {
      invite_token: token,
    });
    setBusy(false);
    setMessage(error ? error.message : "Convite revogado.");
    if (!error) setRevision((n) => n + 1);
  }
  return (
    <section className="card stack">
      <h2>Permissões por unidade</h2>
      <form action={update} className="fields">
        <label className="field">
          Líder
          <select className="input" name="person" required>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Unidade
          <select className="input" name="unit" required>
            {company.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Permissão
          <select className="input" name="allow">
            <option value="yes">Autorizar</option>
            <option value="no">Remover acesso</option>
          </select>
        </label>
        <button className="btn" disabled={busy}>
          Atualizar
        </button>
      </form>
      <p className="muted tiny">
        Remover o acesso impede novas consultas e edições nessa unidade. O
        histórico permanece disponível para a gestão.
      </p>
      <h3>Convites emitidos</h3>
      {invitations.map((i) => (
        <div className="row" key={i.token}>
          <p>
            {i.email} · {i.role === "member" ? "Líder" : "Administrador"} ·{" "}
            {i.accepted_at
              ? "Aceito"
              : new Date(i.expires_at) < new Date()
                ? "Expirado"
                : "Aguardando aceite"}
          </p>
          {!i.accepted_at && new Date(i.expires_at) > new Date() && (
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => void revoke(i.token)}
            >
              Revogar
            </button>
          )}
        </div>
      ))}
      {!invitations.length && <p className="muted">Nenhum convite emitido.</p>}
      {message && (
        <div className="alert" role="status">
          {message}
        </div>
      )}
    </section>
  );
}

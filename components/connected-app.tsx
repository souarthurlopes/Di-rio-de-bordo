"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  LogOut,
  Building2,
  ClipboardCheck,
  Users,
  Plus,
  Copy,
  Mail,
} from "lucide-react";
import { getSupabase } from "../lib/supabase";
import { Company } from "../lib/types";
import { Dashboard } from "../components/dashboard";
import { Records } from "../components/records";
import { Builder } from "../components/builder";
import { TeamAccess } from "../components/team-access";
import { Operations } from "../components/operations";

type CompanyJoin = {
  role: string;
  companies: {
    id: string;
    name: string;
    units: { id: string; name: string }[];
  };
};
const mapCompanies = (rows: unknown): Company[] =>
  (rows as CompanyJoin[]).map((m) => ({
    id: m.companies.id,
    name: m.companies.name,
    units: m.companies.units ?? [],
    role: m.role,
  }));
const errText = (err: unknown) =>
  err instanceof Error
    ? err.message
    : typeof err === "object" && err !== null && "message" in err
      ? String(err.message)
      : String(err);
export default function Home() {
  const [db, setDb] = useState<ReturnType<typeof getSupabase> | null>(null),
    [configError, setConfigError] = useState("");
  const [user, setUser] = useState<User | null>(null),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]),
    [companyId, setCompanyId] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false);
  const [fullName, setFullName] = useState(""),
    [team, setTeam] = useState<
      {
        user_id: string;
        role: string;
        name: string;
        units: string[];
        company_id: string;
      }[]
    >([]);

  const [inviteEmail, setInviteEmail] = useState(""),
    [inviteRole, setInviteRole] = useState<"member" | "manager">("member"),
    [inviteUnit, setInviteUnit] = useState(""),
    [inviteUrl, setInviteUrl] = useState("");
  const [newUnitName, setNewUnitName] = useState(""),
    [newCompanyName, setNewCompanyName] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [recordId, setRecordId] = useState(""),
    [recordLeader, setRecordLeader] = useState("");
  const [companyName, setCompanyName] = useState(""),
    [unitName, setUnitName] = useState("Unidade principal");
  const [view, setView] = useState<
    "dashboard" | "diary" | "team" | "companies" | "models" | "operations"
  >("dashboard");
  useEffect(() => {
    try {
      const client = getSupabase();
      setDb(client);
      client.auth
        .getUser()
        .then(({ data }) => {
          setUser(data.user);
          setBusy(false);
        })
        .catch((e) => {
          setMessage(errText(e));
          setBusy(false);
        });
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setMessage("");
      });
      return () => subscription.unsubscribe();
    } catch (e) {
      setConfigError(errText(e));
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!db || !user) {
      setCompanies([]);
      setTeam([]);
      return;
    }
    let alive = true;
    setCompaniesLoading(true);
    const load = async () => {
      const { data, error } = await db
        .from("memberships")
        .select("company_id,role,companies(id,name,units(id,name))")
        .eq("user_id", user.id);
      if (!alive) return;
      setCompaniesLoading(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      const rows = mapCompanies(data ?? []);
      setCompanies(rows);
      setCompanyId((current) =>
        rows.some((x) => x.id === current) ? current : (rows[0]?.id ?? ""),
      );
    };
    void load();
    return () => {
      alive = false;
    };
  }, [db, user]);
  const company = companies.find((x) => x.id === companyId);
  useEffect(() => {
    if (!db || !user || !companies.length) return;
    let alive = true;
    (async () => {
      const ids = companies.map((c) => c.id);
      const [membersResult, assignmentsResult] = await Promise.all([
        db
          .from("memberships")
          .select("company_id,user_id,role")
          .in("company_id", ids),
        db
          .from("unit_assignments")
          .select("company_id,user_id,unit_id")
          .in("company_id", ids),
      ]);
      if (!alive) return;
      if (membersResult.error || assignmentsResult.error) {
        setMessage(
          (membersResult.error || assignmentsResult.error)?.message ??
            "Erro ao consultar dados",
        );
        return;
      }
      const members = membersResult.data ?? [];
      const userIds = Array.from(new Set(members.map((m) => m.user_id)));
      const { data: profiles } = userIds.length
        ? await db.from("profiles").select("id,display_name").in("id", userIds)
        : { data: [] };
      if (!alive) return;
      setTeam(
        members.map((m) => ({
          user_id: m.user_id,
          role: m.role,
          name:
            profiles?.find((p) => p.id === m.user_id)?.display_name ||
            "Usuário",
          units: (assignmentsResult.data ?? [])
            .filter(
              (a) => a.user_id === m.user_id && a.company_id === m.company_id,
            )
            .map((a) => a.unit_id),
          company_id: m.company_id,
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, [db, user, companies, refresh]);
  useEffect(() => {
    if (company?.units.length) setInviteUnit(company.units[0].id);
  }, [company]);
  useEffect(() => {
    if (!db || !user) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token) return;
    let active = true;
    (async () => {
      const { data, error } = await db.rpc("accept_invitation", {
        invite_token: token,
      });
      if (!active) return;
      if (error) {
        setMessage("Convite: " + error.message);
        return;
      }
      window.history.replaceState({}, "", window.location.pathname);
      setMessage(`Convite aceito: ${data}.`);
      setRefresh((n) => n + 1);
      const { data: rows } = await db
        .from("memberships")
        .select("company_id,role,companies(id,name,units(id,name))")
        .eq("user_id", user.id);
      if (rows) {
        setCompanies(mapCompanies(rows));
      }
    })();
    return () => {
      active = false;
    };
  }, [db, user]);
  async function inviteLeader() {
    if (!db || !companyId) return;
    setBusy(true);
    setMessage("");
    setInviteUrl("");
    const { data, error } = await db.rpc("create_invitation", {
      target_company: companyId,
      target_email: inviteEmail,
      target_role: inviteRole,
      target_unit: inviteRole === "member" ? inviteUnit : null,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setInviteUrl(`${window.location.origin}/?invite=${data}`);
    setMessage("Convite criado. Copie o link e envie para o e-mail informado.");
  }
  async function addUnit() {
    if (!db || !companyId || !newUnitName.trim()) return;
    setBusy(true);
    const { error } = await db
      .from("units")
      .insert({ company_id: companyId, name: newUnitName.trim() });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setNewUnitName("");
    await reloadCompanies();
    setMessage("Unidade cadastrada.");
  }
  async function reloadCompanies() {
    if (!db || !user) return;
    const { data, error } = await db
      .from("memberships")
      .select("company_id,role,companies(id,name,units(id,name))")
      .eq("user_id", user.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setCompanies(mapCompanies(data ?? []));
    setRefresh((n) => n + 1);
  }
  async function renameCompany(f: FormData) {
    if (!db) return;
    setBusy(true);
    const { error } = await db
      .from("companies")
      .update({ name: String(f.get("name")).trim() })
      .eq("id", companyId);
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      await reloadCompanies();
      setMessage("Empresa atualizada.");
    }
  }
  async function renameUnit(f: FormData) {
    if (!db) return;
    setBusy(true);
    const { error } = await db
      .from("units")
      .update({ name: String(f.get("name")).trim() })
      .eq("id", String(f.get("unit")))
      .eq("company_id", companyId);
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      await reloadCompanies();
      setMessage("Unidade atualizada.");
    }
  }
  async function addCompany() {
    if (!db || !newCompanyName.trim()) return;
    setBusy(true);
    const { error } = await db.rpc("new_company", {
      company_name: newCompanyName.trim(),
      unit_name: "Unidade principal",
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setNewCompanyName("");
    await reloadCompanies();
    setMessage("Nova empresa cadastrada.");
  }
  async function authAction() {
    if (!db) return;
    setBusy(true);
    setMessage("");
    const { error, data } = signup
      ? await db.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        })
      : await db.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (signup && !data.session)
      setMessage(
        "Conta criada. Verifique seu e-mail para confirmar o cadastro.",
      );
  }
  async function createCompany() {
    if (!db) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await db.rpc("new_company", {
      company_name: companyName,
      unit_name: unitName,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const { data: rows, error: loadError } = await db
      .from("memberships")
      .select("company_id,role,companies(id,name,units(id,name))")
      .eq("user_id", user!.id);
    if (loadError) {
      setMessage(loadError.message);
      return;
    }
    const mapped = mapCompanies(rows ?? []);
    setCompanies(mapped);
    setCompanyId(data);
    setMessage("Empresa criada com sucesso.");
  }
  if (configError)
    return (
      <div className="authwrap">
        <div className="card auth">
          <h1>Configuração pendente</h1>
          <p className="muted">{configError}</p>
          <p>
            Copie <b>.env.example</b> para <b>.env.local</b> e configure o
            Supabase.
          </p>
        </div>
      </div>
    );
  if (!db || (!user && busy))
    return <div className="authwrap">Carregando…</div>;
  if (!user)
    return (
      <div className="authwrap">
        <div className="auth stack">
          <div>
            <div className="eyebrow">GESTÃO DE EQUIPES</div>
            <h1>Diário de Bordo</h1>
            <p className="muted">
              Acompanhamento simples e organizado, de qualquer lugar.
            </p>
          </div>
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              void authAction();
            }}
          >
            <h2>{signup ? "Criar conta" : "Entrar na plataforma"}</h2>
            {signup && (
              <label className="field">
                Seu nome
                <input
                  className="input"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
            )}
            <label className="field">
              E-mail
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              Senha
              <input
                className="input"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {message && <div className="alert">{message}</div>}
            <button className="btn" disabled={busy}>
              {signup ? "Criar conta" : "Entrar"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setSignup(!signup);
                setMessage("");
              }}
            >
              {signup ? "Já tenho conta" : "Não tenho conta — cadastrar"}
            </button>
          </form>
        </div>
      </div>
    );
  if (companiesLoading)
    return (
      <div className="authwrap" role="status">
        Carregando empresas autorizadas…
      </div>
    );
  if (!company)
    return (
      <div className="authwrap">
        <div className="auth stack">
          <div>
            <div className="eyebrow">PRIMEIRO ACESSO</div>
            <h1>Seu espaço de acompanhamento</h1>
            <p className="muted">
              Se recebeu um convite, abra o link após confirmar seu e-mail. O
              cadastro de empresas é reservado à gestora provisionada.
            </p>
          </div>
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              void createCompany();
            }}
          >
            <label className="field">
              Nome da empresa
              <input
                className="input"
                required
                minLength={2}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex.: VELO BH"
              />
            </label>
            <label className="field">
              Primeira unidade
              <input
                className="input"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Ex.: Pampulha"
              />
            </label>
            {message && <div className="alert">{message}</div>}
            <button className="btn" disabled={busy}>
              Criar espaço da empresa
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => void db.auth.signOut()}
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    );
  return (
    <div className="page">
      <aside className="sidebar">
        <div className="logo">
          Bordo<span>GESTÃO DE EQUIPES</span>
        </div>
        <nav className="stack">
          <button
            className={"navitem " + (view === "dashboard" ? "active" : "")}
            onClick={() => setView("dashboard")}
          >
            <LayoutDashboard size={18} />
            <span className="navtext">Visão geral</span>
          </button>
          <button
            className={"navitem " + (view === "diary" ? "active" : "")}
            onClick={() => {
              setRecordId("");
              setRecordLeader("");
              setView("diary");
            }}
          >
            <ClipboardCheck size={18} />
            <span className="navtext">Diário de bordo</span>
          </button>
          {company.role !== "member" && (
            <>
              <button
                className={"navitem " + (view === "team" ? "active" : "")}
                onClick={() => setView("team")}
              >
                <Users size={18} />
                <span className="navtext">Líderes</span>
              </button>
              <button
                className={"navitem " + (view === "companies" ? "active" : "")}
                onClick={() => setView("companies")}
              >
                <Building2 size={18} />
                <span className="navtext">Empresas e unidades</span>
              </button>
            </>
          )}
          <button
            className={"navitem " + (view === "operations" ? "active" : "")}
            onClick={() => setView("operations")}
          >
            <ClipboardCheck size={18} />
            <span className="navtext">Ocorrências e ações</span>
          </button>
          {company.role !== "member" && (
            <button
              className={"navitem " + (view === "models" ? "active" : "")}
              onClick={() => setView("models")}
            >
              <Plus size={18} />
              <span className="navtext">Modelos de diário</span>
            </button>
          )}
        </nav>
        <div className="sidefooter">
          <div>{user.email}</div>
          <button className="navitem" onClick={() => void db.auth.signOut()}>
            <LogOut size={16} />
            <span className="navtext">Sair</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="top">
          <div>
            <div className="eyebrow">GESTÃO MULTIEMPRESA</div>
            <h1>
              {view === "dashboard"
                ? "Painel da gestora"
                : view === "diary"
                  ? "Diário de Bordo"
                  : view === "team"
                    ? "Líderes"
                    : view === "models"
                      ? "Modelos de diário"
                      : view === "operations"
                        ? "Ocorrências e ações"
                        : "Empresas e unidades"}
            </h1>
            <div className="muted">
              Acompanhamento de atividades, resultados e pendências.
            </div>
          </div>
          <div className="row">
            <label className="field inlinefield">
              Empresa
              <select
                className="input"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                {companies.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {message && view !== "diary" && <div className="alert">{message}</div>}
        {company.role === "member" &&
        ["team", "companies", "models"].includes(view) ? (
          <Records
            key={company.id}
            db={db}
            company={company}
            user={user.id}
            initialEntry={recordId}
            initialLeader={recordLeader}
            onChange={() => setRefresh((n) => n + 1)}
          />
        ) : view === "dashboard" ? (
          <Dashboard
            db={db}
            companies={companies}
            revision={refresh}
            onOpen={(id, entry) => {
              setCompanyId(id);
              setRecordId(entry);
              setRecordLeader("");
              setView("diary");
            }}
          />
        ) : view === "team" ? (
          <div className="stack">
            <div className="card stack">
              <h2>Líderes e gestores — {company.name}</h2>
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Perfil</th>
                      <th>Unidade(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team
                      .filter((t) => t.company_id === companyId)
                      .map((t) => (
                        <tr key={t.user_id}>
                          <td>
                            <button
                              className="btn secondary"
                              onClick={() => {
                                setRecordLeader(t.user_id);
                                setRecordId("");
                                setView("diary");
                              }}
                            >
                              {t.name}
                            </button>
                          </td>
                          <td>
                            {t.role === "owner"
                              ? "Responsável"
                              : t.role === "manager"
                                ? "Gestor"
                                : "Líder"}
                          </td>
                          <td>
                            {t.role === "member"
                              ? t.units
                                  .map(
                                    (id: string) =>
                                      company.units.find((u) => u.id === id)
                                        ?.name ?? "",
                                  )
                                  .join(", ") || "Sem unidade"
                              : "Todas as unidades"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <form
              className="card stack"
              onSubmit={(e) => {
                e.preventDefault();
                void inviteLeader();
              }}
            >
              <h2>Convidar pessoa</h2>
              <p className="muted">
                O convite é vinculado ao e-mail da pessoa e expira em 7 dias. O
                link precisa ser enviado manualmente.
              </p>
              <div className="fields">
                <label className="field">
                  E-mail
                  <input
                    className="input"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  Perfil
                  <select
                    className="input"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "member" | "manager")
                    }
                  >
                    <option value="member">Líder</option>
                    <option value="manager">Gestor da empresa</option>
                  </select>
                </label>
                {inviteRole === "member" && (
                  <label className="field">
                    Unidade
                    <select
                      className="input"
                      value={inviteUnit}
                      onChange={(e) => setInviteUnit(e.target.value)}
                    >
                      {company.units.map((u) => (
                        <option value={u.id} key={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <button className="btn" disabled={busy}>
                {" "}
                <Mail size={16} /> Gerar convite
              </button>
              {inviteUrl && (
                <div className="row">
                  <input
                    className="input invitefield"
                    readOnly
                    aria-label="Link de convite"
                    value={inviteUrl}
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() =>
                      void navigator.clipboard.writeText(inviteUrl)
                    }
                  >
                    <Copy size={15} /> Copiar
                  </button>
                </div>
              )}
            </form>
            <TeamAccess
              db={db}
              company={company}
              onChange={() => setRefresh((n) => n + 1)}
            />
          </div>
        ) : view === "companies" ? (
          <div className="stack">
            <div className="card stack">
              <h2>Empresas sob acompanhamento</h2>
              <div className="companygrid">
                {companies.map((c) => (
                  <button
                    className={
                      "companytile " + (companyId === c.id ? "selected" : "")
                    }
                    key={c.id}
                    onClick={() => setCompanyId(c.id)}
                  >
                    <Building2 size={20} />
                    <strong>{c.name}</strong>
                    <span className="muted tiny">
                      {c.units.length} unidades ·{" "}
                      {c.role === "member" ? "Líder" : "Gestão"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <form
              className="card stack"
              onSubmit={(e) => {
                e.preventDefault();
                void addCompany();
              }}
            >
              <h2>Nova empresa</h2>
              <div className="row">
                <input
                  className="input flexible"
                  placeholder="Nome da empresa"
                  required
                  minLength={2}
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
                <button className="btn" disabled={busy}>
                  <Plus size={16} /> Cadastrar empresa
                </button>
              </div>
            </form>
            <div className="card stack">
              <h2>Informações de {company.name}</h2>
              <form action={renameCompany} className="row">
                <label className="field">
                  Nome da empresa
                  <input
                    name="name"
                    className="input"
                    required
                    minLength={2}
                    defaultValue={company.name}
                    key={company.id}
                  />
                </label>
                <button className="btn secondary" disabled={busy}>
                  Atualizar empresa
                </button>
              </form>
              <h2>Unidades de {company.name}</h2>
              {company.units.map((u) => (
                <form className="row" action={renameUnit} key={u.id}>
                  <input type="hidden" name="unit" value={u.id} />
                  <label className="field">
                    Nome da unidade
                    <input
                      name="name"
                      className="input"
                      required
                      defaultValue={u.name}
                    />
                  </label>
                  <button className="btn secondary" disabled={busy}>
                    Atualizar unidade
                  </button>
                </form>
              ))}
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addUnit();
                }}
              >
                <input
                  className="input flexible"
                  placeholder="Nome da nova unidade"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  required
                />
                <button className="btn secondary" disabled={busy}>
                  <Plus size={16} /> Nova unidade
                </button>
              </form>
            </div>
          </div>
        ) : view === "models" ? (
          <Builder db={db} company={companyId} />
        ) : view === "operations" ? (
          <Operations db={db} company={company} user={user.id} />
        ) : (
          <Records
            key={company.id}
            db={db}
            company={company}
            user={user.id}
            initialEntry={recordId}
            initialLeader={recordLeader}
            onChange={() => setRefresh((n) => n + 1)}
          />
        )}
        <div className="footertext">
          Diário de Bordo · Acompanhamento de líderes
        </div>
      </main>
    </div>
  );
}

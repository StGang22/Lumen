import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Cpu,
  Fingerprint,
  Home as HomeIcon,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Unplug,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import MemoryView from "@/components/MemoryView";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

type Section = "overview" | "approvals" | "memory" | "spaces" | "wellbeing" | "security" | "agent";

const navigation: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard },
  { id: "approvals", label: "Aprobaciones", icon: CheckCircle2 },
  { id: "memory", label: "Memoria", icon: BookOpen },
  { id: "spaces", label: "Casa y empresas", icon: HomeIcon },
  { id: "wellbeing", label: "Bienestar", icon: Activity },
  { id: "security", label: "Ciberseguridad", icon: Shield },
  { id: "agent", label: "Agente local", icon: Cpu },
];

const titles: Record<Section, { eyebrow: string; title: string; subtitle: string }> = {
  overview: { eyebrow: "CENTRO DE CONTROL", title: "Tu espacio, bajo tu control.", subtitle: "Una vista clara de lo conectado, lo pendiente y lo que todavía requiere tu decisión." },
  approvals: { eyebrow: "DECISIONES", title: "Aprobaciones", subtitle: "Las decisiones importantes esperan tu autorización; aprobar aquí solo registra tu decisión, no ejecuta la acción." },
  memory: { eyebrow: "CONTEXTO PERSONAL", title: "Memoria editable.", subtitle: "Lumen solo conserva lo que tú agregas y puedes consultar, corregir o borrar cuando quieras." },
  spaces: { eyebrow: "CONTEXTOS", title: "Casa y empresas", subtitle: "Personal, hogar y trabajo tienen etiquetas separadas. Los espacios nominales para cada empresa y sus integraciones aún deben configurarse." },
  wellbeing: { eyebrow: "BIENESTAR", title: "Señales, no diagnósticos.", subtitle: "Lumen puede describir tendencias cuando una fuente real esté conectada; nunca sustituye a un profesional de salud." },
  security: { eyebrow: "DEFENSA AUTORIZADA", title: "Activos bajo tu protección.", subtitle: "El inventario no inicia escaneos. Lumen solo puede ayudar con sistemas tuyos o expresamente autorizados." },
  agent: { eyebrow: "DISPOSITIVO LOCAL", title: "Conecta tu agente local.", subtitle: "El agente inicial informa presencia y estado. No recibe comandos arbitrarios ni ejecuta acciones remotas." },
};

const contextLabel: Record<string, string> = { personal: "Personal", home: "Hogar", business: "Empresa" };
const categoryLabel: Record<string, string> = { financial: "Financiera", home: "Hogar", business: "Empresa", security: "Seguridad" };
const statusLabel: Record<string, string> = { pending: "Pendiente", approved: "Aprobación registrada", rejected: "Rechazada", expired: "Vencida" };

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sin actividad";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatMoney(amountCents: number | null, currency: string | null) {
  if (amountCents === null || !currency) return null;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amountCents / 100);
}

function Badge({ children, kind = "neutral" }: { children: ReactNode; kind?: "neutral" | "good" | "warn" | "danger" }) {
  return <span className={`lumen-badge lumen-badge-${kind}`}><span className="lumen-badge-dot" />{children}</span>;
}

function StatCard({ label, value, hint, icon: Icon, tone = "warm" }: { label: string; value: string | number; hint: string; icon: typeof Activity; tone?: "warm" | "dark" | "green" }) {
  return <article className={`lumen-stat lumen-stat-${tone}`}><div className="lumen-stat-head"><span>{label}</span><span className="lumen-stat-icon"><Icon size={16} /></span></div><strong>{value}</strong><small>{hint}</small></article>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return <div className="lumen-empty"><span className="lumen-empty-icon"><Icon size={19} /></span><strong>{title}</strong><p>{detail}</p></div>;
}

function Panel({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`lumen-panel ${className}`}><div className="lumen-panel-head"><div>{eyebrow && <span className="lumen-eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>{children}</section>;
}

export default function Home() {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const routeSegment = location.split("/").filter(Boolean)[0] || "overview";
  const section: Section = navigation.some(item => item.id === routeSegment) ? routeSegment as Section : "overview";
  const page = titles[section];
  const utils = trpc.useUtils();
  const [notice, setNotice] = useState("");
  const [pairCode, setPairCode] = useState<{ code: string; expiresAt: Date } | null>(null);
  const [copied, setCopied] = useState(false);

  const overview = trpc.lumen.overview.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const approvals = trpc.lumen.approvals.list.useQuery(undefined, { enabled: Boolean(user) && section === "approvals", retry: false });
  const audit = trpc.lumen.audit.list.useQuery(undefined, { enabled: Boolean(user) && section === "overview", retry: false });
  const devices = trpc.lumen.agent.list.useQuery(undefined, { enabled: Boolean(user) && section === "agent", retry: false });
  const assets = trpc.lumen.security.assets.useQuery(undefined, { enabled: Boolean(user) && section === "security", retry: false });
  const memories = trpc.lumen.memory.list.useQuery(undefined, { enabled: Boolean(user) && section === "memory", retry: false });

  const createApproval = trpc.lumen.approvals.create.useMutation({
    onSuccess: async () => {
      setNotice("Solicitud registrada. Ningún pago ni acción externa se ha ejecutado.");
      await Promise.all([utils.lumen.approvals.list.invalidate(), utils.lumen.overview.invalidate()]);
    },
    onError: error => setNotice(error.message),
  });
  const decideApproval = trpc.lumen.approvals.decide.useMutation({
    onSuccess: async result => {
      setNotice(result.status === "expired" ? "La solicitud venció sin ejecutar una acción." : "Decisión registrada. No se ejecutó ninguna acción externa.");
      await Promise.all([utils.lumen.approvals.list.invalidate(), utils.lumen.overview.invalidate(), utils.lumen.audit.list.invalidate()]);
    },
    onError: error => setNotice(error.message),
  });
  const makePairCode = trpc.lumen.agent.createPairingCode.useMutation({
    onSuccess: result => {
      setPairCode({ code: result.pairingCode, expiresAt: result.expiresAt });
      setCopied(false);
      setNotice("Código de un solo uso generado. Caduca en cinco minutos.");
    },
    onError: error => setNotice(error.message),
  });
  const revokeDevice = trpc.lumen.agent.revoke.useMutation({
    onSuccess: async () => {
      setNotice("Credencial del agente revocada.");
      await Promise.all([utils.lumen.agent.list.invalidate(), utils.lumen.overview.invalidate()]);
    },
    onError: error => setNotice(error.message),
  });
  const registerAsset = trpc.lumen.security.registerAsset.useMutation({
    onSuccess: async () => {
      setNotice("Activo añadido al inventario autorizado. No se ha iniciado un escaneo.");
      await Promise.all([utils.lumen.security.assets.invalidate(), utils.lumen.overview.invalidate(), utils.lumen.audit.list.invalidate()]);
    },
    onError: error => setNotice(error.message),
  });
  const askLumen = trpc.lumen.assistant.ask.useMutation();

  const createMemory = trpc.lumen.memory.create.useMutation({
    onSuccess: async () => { setNotice("Nota guardada en tu memoria editable."); await Promise.all([utils.lumen.memory.list.invalidate(), utils.lumen.audit.list.invalidate()]); },
    onError: error => setNotice(error.message),
  });
  const updateMemory = trpc.lumen.memory.update.useMutation({
    onSuccess: async () => { setNotice("Nota actualizada."); await Promise.all([utils.lumen.memory.list.invalidate(), utils.lumen.audit.list.invalidate()]); },
    onError: error => setNotice(error.message),
  });
  const deleteMemory = trpc.lumen.memory.delete.useMutation({
    onSuccess: async () => { setNotice("Nota eliminada de la memoria de Lumen."); await Promise.all([utils.lumen.memory.list.invalidate(), utils.lumen.audit.list.invalidate()]); },
    onError: error => setNotice(error.message),
  });

  if (loading) {
    return <div className="lumen-loading"><div className="lumen-spinner" /><span>Abriendo tu espacio seguro…</span></div>;
  }
  if (!user) {
    return <main className="lumen-auth"><div className="lumen-auth-card"><img src="/lumen-mark.svg" alt="" /><span className="lumen-eyebrow">LUMEN · ESPACIO PRIVADO</span><h1>Tu control empieza contigo.</h1><p>Inicia sesión para entrar al panel privado. Lumen no simula usuarios ni muestra datos de ejemplo.</p><button className="lumen-button lumen-button-primary" onClick={() => startLogin()}>Iniciar sesión <ChevronRight size={16} /></button></div></main>;
  }

  const navigate = (target: Section) => {
    setNotice("");
    setLocation(target === "overview" ? "/" : `/${target}`);
  };

  return (
    <div className="lumen-app">
      <aside className="lumen-sidebar">
        <a className="lumen-brand" href="/" onClick={event => { event.preventDefault(); navigate("overview"); }}>
          <img src="/lumen-mark.svg" alt="" /><span>Lumen<small>PERSONAL INTELLIGENCE</small></span>
        </a>
        <div className="lumen-side-label">TU ESPACIO</div>
        <nav className="lumen-nav" aria-label="Navegación principal">
          {navigation.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`lumen-nav-item ${section === item.id ? "is-active" : ""}`} onClick={() => navigate(item.id)} aria-current={section === item.id ? "page" : undefined}>
              <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === "approvals" && (overview.data?.pendingApprovals ?? 0) > 0 && <b>{overview.data?.pendingApprovals}</b>}
            </button>;
          })}
        </nav>
        <div className="lumen-sidebar-bottom">
          <div className="lumen-secure-note"><Fingerprint size={16} /><span>Sesión protegida<br /><small>Datos separados por cuenta</small></span></div>
          <button className="lumen-profile" onClick={() => void logout()} title="Cerrar sesión"><span className="lumen-avatar">{user.name?.slice(0, 1).toUpperCase() || "L"}</span><span className="lumen-profile-meta"><strong>{user.name || "Cuenta Lumen"}</strong><small>Cerrar sesión</small></span><LogOut size={15} /></button>
        </div>
      </aside>

      <main className="lumen-main">
        <header className="lumen-topbar"><div className="lumen-breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{navigation.find(item => item.id === section)?.label}</strong></div><div className="lumen-topbar-right"><span className="lumen-online-dot" />{overview.isLoading ? "Actualizando" : "Control supervisado"}<span className="lumen-topbar-separator" /><span className="lumen-user-name">{user.name || "Cuenta"}</span></div></header>
        <div className="lumen-content">
          <div className="lumen-page-heading"><div><span className="lumen-eyebrow">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.subtitle}</p></div><div className="lumen-heading-mark"><span /><span /><span /></div></div>
          {notice && <div className="lumen-notice" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso"><X size={15} /></button></div>}

          {section === "overview" && <OverviewView overview={overview.data} audit={audit.data} onOpen={navigate} />}
          {section === "approvals" && <ApprovalsView rows={approvals.data ?? []} isLoading={approvals.isLoading} onCreate={input => createApproval.mutate(input)} isCreating={createApproval.isPending} onDecision={(id, decision) => decideApproval.mutate({ id, decision })} isDeciding={decideApproval.isPending} />}
          {section === "memory" && <MemoryView rows={memories.data ?? []} isLoading={memories.isLoading} isSaving={createMemory.isPending || updateMemory.isPending || deleteMemory.isPending} onCreate={input => createMemory.mutate(input)} onUpdate={input => updateMemory.mutate(input)} onDelete={id => deleteMemory.mutate({ id })} />}
          {section === "spaces" && <SpacesView onOpen={navigate} />}
          {section === "wellbeing" && <WellbeingView />}
          {section === "security" && <SecurityView rows={assets.data ?? []} isLoading={assets.isLoading} onRegister={input => registerAsset.mutate(input)} isSaving={registerAsset.isPending} />}
          {section === "agent" && <AgentView rows={devices.data ?? []} isLoading={devices.isLoading} pairCode={pairCode} onGenerate={() => makePairCode.mutate()} isGenerating={makePairCode.isPending} onRevoke={id => revokeDevice.mutate({ id })} isRevoking={revokeDevice.isPending} copied={copied} onCopy={async () => { if (!pairCode) return; await navigator.clipboard.writeText(pairCode.code); setCopied(true); }} />}
          {section === "overview" && <AssistantPanel ask={message => askLumen.mutateAsync({ message })} isAsking={askLumen.isPending} error={askLumen.error?.message ?? ""} />}
        </div>
      </main>
    </div>
  );
}

function OverviewView({ overview, audit, onOpen }: { overview?: { pendingApprovals: number; pairedDevices: number; registeredAssets: number; integrationsConnected: number }; audit?: Array<{ id: string; event: string; summary: string; createdAt: Date }>; onOpen: (section: Section) => void }) {
  return <>
    <section className="lumen-hero"><div className="lumen-hero-copy"><span className="lumen-eyebrow">PANEL DE OPERACIONES · 01</span><h2>Claridad para lo que importa.</h2><p>Lumen puede ayudarte a pensar y organizar; las acciones con impacto siguen bajo tu autorización.</p><div className="lumen-hero-tags"><span><LockKeyhole size={13} /> Privado</span><span><Fingerprint size={13} /> Supervisado</span><span><Unplug size={13} /> Sin integraciones activas</span></div></div><div className="lumen-hero-emblem" aria-hidden="true"><div className="lumen-emblem-orbit orbit-a" /><div className="lumen-emblem-orbit orbit-b" /><div className="lumen-emblem-core"><span /></div></div></section>
    <div className="lumen-stat-grid">
      <StatCard label="Decisiones pendientes" value={overview?.pendingApprovals ?? "—"} hint="Requieren tu revisión" icon={CheckCircle2} tone="warm" />
      <StatCard label="Agentes locales" value={overview?.pairedDevices ?? "—"} hint="Dispositivos emparejados" icon={Cpu} tone="dark" />
      <StatCard label="Activos inventariados" value={overview?.registeredAssets ?? "—"} hint="Declarados como propios/autorizados" icon={ShieldCheck} tone="green" />
      <StatCard label="Servicios conectados" value={overview?.integrationsConnected ?? "—"} hint="Reloj, hogar, empresa y seguridad" icon={Zap} tone="warm" />
    </div>
    <div className="lumen-overview-grid">
      <Panel title="Ámbitos de Lumen" eyebrow="SEPARACIÓN POR CONTEXTO" action={<button className="lumen-text-button" onClick={() => onOpen("spaces")}>Ver espacios <ArrowUpRight size={14} /></button>}>
        <div className="lumen-domain-list">
          <DomainRow icon={HomeIcon} title="Hogar" note="Sin plataforma domótica conectada" />
          <DomainRow icon={Building2} title="Empresas" note="Sin sistemas empresariales conectados" />
          <DomainRow icon={Activity} title="Bienestar" note="Sin reloj o fuente de métricas conectada" />
        </div>
      </Panel>
      <Panel title="Registro reciente" eyebrow="TRANSPARENCIA" action={<button className="lumen-text-button" onClick={() => onOpen("approvals")}>Aprobaciones <ArrowUpRight size={14} /></button>}>
        {audit?.length ? <div className="lumen-audit-list">{audit.slice(0, 4).map(event => <div className="lumen-audit-row" key={event.id}><span className="lumen-audit-marker"><Clock3 size={14} /></span><div><strong>{event.summary}</strong><small>{formatDate(event.createdAt)} · {event.event}</small></div></div>)}</div> : <EmptyState icon={Clock3} title="Todavía no hay actividad" detail="Las decisiones y cambios autorizados aparecerán aquí, con fecha y contexto." />}
      </Panel>
    </div>
    <div className="lumen-guardrail"><ShieldCheck size={17} /><p><strong>Tu aprobación siempre es la última palabra.</strong> Las decisiones financieras importantes quedan en espera hasta que tú respondas; esta versión no ejecuta pagos ni acciones externas.</p></div>
  </>;
}

function DomainRow({ icon: Icon, title, note }: { icon: typeof HomeIcon; title: string; note: string }) {
  return <div className="lumen-domain-row"><span className="lumen-domain-icon"><Icon size={17} /></span><span className="lumen-domain-copy"><strong>{title}</strong><small>{note}</small></span><Badge>Sin conectar</Badge></div>;
}

type ApprovalInput = { context: "personal" | "home" | "business"; category: "financial" | "home" | "business" | "security"; title: string; details: string; amountCents?: number; currency?: string };

function ApprovalsView({ rows, isLoading, onCreate, isCreating, onDecision, isDeciding }: { rows: Array<{ id: string; context: string; category: string; title: string; details: string; amountCents: number | null; currency: string | null; status: string; createdAt: Date; expiresAt: Date }>; isLoading: boolean; onCreate: (input: ApprovalInput) => void; isCreating: boolean; onDecision: (id: string, decision: "approved" | "rejected") => void; isDeciding: boolean }) {
  const [context, setContext] = useState<ApprovalInput["context"]>("personal");
  const [category, setCategory] = useState<ApprovalInput["category"]>("financial");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input: ApprovalInput = { context, category, title: title.trim(), details: details.trim() };
    if (category === "financial") {
      input.amountCents = Math.round(Number(amount) * 100);
      input.currency = currency.toUpperCase();
    }
    onCreate(input);
    setTitle(""); setDetails(""); setAmount("");
  };
  return <div className="lumen-page-grid">
    <Panel title="Crear una solicitud" eyebrow="SIN EJECUCIÓN EXTERNA" className="lumen-form-panel">
      <form className="lumen-form" onSubmit={submit}>
        <div className="lumen-form-grid"><label>Contexto<select value={context} onChange={event => setContext(event.target.value as ApprovalInput["context"])}><option value="personal">Personal</option><option value="home">Hogar</option><option value="business">Empresa</option></select></label><label>Tipo de decisión<select value={category} onChange={event => setCategory(event.target.value as ApprovalInput["category"])}><option value="financial">Financiera</option><option value="home">Hogar</option><option value="business">Empresa</option><option value="security">Seguridad</option></select></label></div>
        <label>Título<input value={title} onChange={event => setTitle(event.target.value)} minLength={3} maxLength={120} required placeholder="Ej. Revisar la propuesta de renovación" /></label>
        <label>Detalles<textarea value={details} onChange={event => setDetails(event.target.value)} minLength={5} maxLength={3000} required rows={4} placeholder="Describe la decisión para que quede registrada con contexto." /></label>
        {category === "financial" && <div className="lumen-form-grid"><label>Monto<input type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /></label><label>Moneda<select value={currency} onChange={event => setCurrency(event.target.value)}><option>USD</option><option>MXN</option><option>EUR</option><option>CAD</option><option>GBP</option></select></label></div>}
        <div className="lumen-form-note"><LockKeyhole size={15} /><span>Este registro captura una decisión humana. <strong>No inicia pagos, compras, transferencias ni cambios de sistemas.</strong></span></div>
        <button className="lumen-button lumen-button-primary" disabled={isCreating}>{isCreating ? <><RefreshCw className="spin" size={15} /> Guardando…</> : <><Plus size={16} /> Enviar a revisión</>}</button>
      </form>
    </Panel>
    <Panel title="Solicitudes recientes" eyebrow={`${rows.length} REGISTRO${rows.length === 1 ? "" : "S"}`} className="lumen-approval-list-panel">
      {isLoading ? <div className="lumen-inline-loading"><div className="lumen-spinner" /> Cargando solicitudes…</div> : rows.length ? <div className="lumen-approval-list">{rows.map(row => {
        const expired = row.status === "pending" && new Date(row.expiresAt).getTime() <= Date.now();
        const state = expired ? "expired" : row.status;
        return <article className="lumen-approval-card" key={row.id}>
          <div className="lumen-approval-top"><div><Badge kind={state === "pending" ? "warn" : state === "approved" ? "good" : state === "rejected" ? "danger" : "neutral"}>{statusLabel[state] ?? state}</Badge><span className="lumen-approval-category">{categoryLabel[row.category]} · {contextLabel[row.context]}</span></div>{row.amountCents !== null && <strong className="lumen-amount">{formatMoney(row.amountCents, row.currency)}</strong>}</div>
          <h3>{row.title}</h3><p>{row.details}</p><div className="lumen-approval-meta"><span><Clock3 size={13} /> Creada {formatDate(row.createdAt)}</span>{state === "pending" && <span>Vence {formatDate(row.expiresAt)}</span>}</div>
          {state === "pending" && <div className="lumen-approval-actions"><button className="lumen-button lumen-button-quiet" disabled={isDeciding} onClick={() => onDecision(row.id, "rejected")}><X size={15} /> Rechazar</button><button className="lumen-button lumen-button-primary" disabled={isDeciding} onClick={() => onDecision(row.id, "approved")}><Check size={15} /> Aprobar registro</button></div>}
          {(state === "approved" || state === "rejected") && <div className="lumen-record-only"><Check size={14} /> Decisión guardada; no se ejecutó una acción externa.</div>}
          {state === "expired" && <div className="lumen-record-only"><Clock3 size={14} /> Venció sin ejecutar una acción.</div>}
        </article>;
      })}</div> : <EmptyState icon={CheckCircle2} title="No hay solicitudes todavía" detail="Cuando registres una decisión importante, aparecerá aquí y podrás dejar constancia de tu respuesta." />}
    </Panel>
  </div>;
}

function SpacesView({ onOpen }: { onOpen: (section: Section) => void }) {
  const domains = [
    { title: "Casa", icon: HomeIcon, detail: "Domótica y rutinas del hogar", status: "Plataforma por elegir", text: "No se controlan cerraduras, luces ni equipos hasta conectar una plataforma y revisar sus permisos." },
    { title: "Empresas", icon: Building2, detail: "Contextos de trabajo separados", status: "Sistemas por elegir", text: "No se ha conectado correo, CRM, contabilidad ni otro sistema de empresa." },
    { title: "Bienestar", icon: Activity, detail: "Lecturas descriptivas de smartwatch", status: "Reloj por conectar", text: "No hay lecturas disponibles. Lumen no diagnostica ni recomienda tratamientos." },
  ];
  return <>
    <div className="lumen-context-banner"><Fingerprint size={19} /><div><strong>Los ámbitos se etiquetan por separado; las empresas individuales aún no están configuradas.</strong><p>Las solicitudes y activos se etiquetan como personales, del hogar o de trabajo. Cada empresa necesitará su propio espacio y permisos antes de conectar datos o sistemas.</p></div></div>
    <div className="lumen-connection-grid">{domains.map(({ title, icon: Icon, detail, status, text }) => <article key={title} className="lumen-connection-card"><div className="lumen-connection-icon"><Icon size={19} /></div><Badge>{status}</Badge><h2>{title}</h2><span>{detail}</span><p>{text}</p><button className="lumen-text-button" onClick={() => onOpen(title === "Bienestar" ? "wellbeing" : title === "Casa" ? "spaces" : "spaces")}>Ver estado <ChevronRight size={14} /></button></article>)}</div>
    <div className="lumen-warning-line"><LockKeyhole size={16} /> No hay compras, pagos, cerraduras ni cambios empresariales habilitados en esta versión.</div>
  </>;
}

function WellbeingView() {
  return <div className="lumen-page-grid lumen-wellbeing-grid">
    <Panel title="Fuentes de bienestar" eyebrow="DATOS AÚN NO DISPONIBLES"><div className="lumen-source-card"><span className="lumen-source-icon"><Smartphone size={19} /></span><div><strong>Smartwatch</strong><small>Plataforma y dispositivo sin seleccionar</small></div><Badge>Sin conectar</Badge></div><EmptyState icon={Activity} title="No hay lecturas recientes" detail="Lumen no inventa datos. Cuando se habilite una fuente, aquí podrás revisar valores, fecha y origen." /></Panel>
    <Panel title="Límites de uso" eyebrow="BIENESTAR, NO MEDICINA"><div className="lumen-limit-list"><LimitRow icon={Activity} title="Tendencias descriptivas" text="Resumen de métricas con fecha y unidad, si una fuente autorizada las aporta." /><LimitRow icon={Stethoscope} title="Sin diagnóstico" text="No detecta enfermedades, no interpreta una lectura como diagnóstico ni prescribe tratamientos." /><LimitRow icon={LockKeyhole} title="Datos mínimos" text="La integración y la retención se definen antes de guardar información de salud." /></div></Panel>
  </div>;
}

function LimitRow({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return <div className="lumen-limit-row"><span><Icon size={16} /></span><div><strong>{title}</strong><p>{text}</p></div></div>;
}

type AssetInput = { context: "personal" | "home" | "business"; kind: "device" | "network" | "server"; label: string; authorizationConfirmed: true };
function SecurityView({ rows, isLoading, onRegister, isSaving }: { rows: Array<{ id: string; context: string; kind: string; label: string; createdAt: Date }>; isLoading: boolean; onRegister: (input: AssetInput) => void; isSaving: boolean }) {
  const [context, setContext] = useState<AssetInput["context"]>("personal");
  const [kind, setKind] = useState<AssetInput["kind"]>("device");
  const [label, setLabel] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!authorized) return; onRegister({ context, kind, label: label.trim(), authorizationConfirmed: true }); setLabel(""); setAuthorized(false); };
  return <div className="lumen-page-grid">
    <Panel title="Registrar un activo" eyebrow="SOLO PROPIEDAD O AUTORIZACIÓN EXPRESA">
      <form className="lumen-form" onSubmit={submit}><label>Nombre del activo<input value={label} onChange={event => setLabel(event.target.value)} minLength={2} maxLength={100} required placeholder="Ej. Servidor de oficina principal" /></label><div className="lumen-form-grid"><label>Tipo<select value={kind} onChange={event => setKind(event.target.value as AssetInput["kind"])}><option value="device">Dispositivo</option><option value="network">Red</option><option value="server">Servidor</option></select></label><label>Contexto<select value={context} onChange={event => setContext(event.target.value as AssetInput["context"])}><option value="personal">Personal</option><option value="home">Hogar</option><option value="business">Empresa</option></select></label></div><label className="lumen-check"><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} /><span>Confirmo que el activo me pertenece o tengo autorización explícita para administrarlo.</span></label><div className="lumen-form-note"><ShieldAlert size={15} /><span>Registrar solo crea un inventario. <strong>No escanea, bloquea ni modifica el activo.</strong></span></div><button className="lumen-button lumen-button-primary" disabled={!authorized || isSaving}>{isSaving ? "Guardando…" : <><Plus size={15} /> Añadir al inventario</>}</button></form>
    </Panel>
    <Panel title="Inventario autorizado" eyebrow={`${rows.length} ACTIVO${rows.length === 1 ? "" : "S"}`}>
      {isLoading ? <div className="lumen-inline-loading"><div className="lumen-spinner" /> Cargando inventario…</div> : rows.length ? <div className="lumen-asset-list">{rows.map(asset => <div className="lumen-asset-row" key={asset.id}><span className="lumen-asset-icon">{asset.kind === "server" ? <Cpu size={16} /> : asset.kind === "network" ? <Shield size={16} /> : <Smartphone size={16} />}</span><span><strong>{asset.label}</strong><small>{contextLabel[asset.context]} · {asset.kind} · añadido {formatDate(asset.createdAt)}</small></span><Badge kind="good">Autorizado</Badge></div>)}</div> : <EmptyState icon={ShieldCheck} title="Inventario vacío" detail="No se han declarado activos. No hay escaneos ni alertas simuladas." />}
      <div className="lumen-security-footnote"><LockKeyhole size={14} /> La monitorización continua requiere una integración defensiva real; todavía no está conectada.</div>
    </Panel>
  </div>;
}

function AgentView({ rows, isLoading, pairCode, onGenerate, isGenerating, onRevoke, isRevoking, copied, onCopy }: { rows: Array<{ id: string; name: string; status: string; lastSeenAt: Date | null; createdAt: Date; revokedAt: Date | null }>; isLoading: boolean; pairCode: { code: string; expiresAt: Date } | null; onGenerate: () => void; isGenerating: boolean; onRevoke: (id: string) => void; isRevoking: boolean; copied: boolean; onCopy: () => void }) {
  return <div className="lumen-page-grid">
    <Panel title="Pareo de un solo uso" eyebrow="TOKEN REVOCABLE · VENCE EN 5 MIN">
      <div className="lumen-pair-intro"><span className="lumen-pair-orb"><Cpu size={21} /></span><p>Genera un código temporal y úsalo en el equipo que ejecutará el agente local. El token de dispositivo se guarda como hash en el servidor y en el almacén seguro del sistema operativo.</p></div>
      {pairCode && <div className="lumen-pair-code"><span className="lumen-eyebrow">CÓDIGO · COMPÁRTELO SOLO CON TU DISPOSITIVO</span><code>{pairCode.code}</code><div><small>Vence {formatDate(pairCode.expiresAt)}</small><button className="lumen-button lumen-button-quiet" onClick={onCopy}><Copy size={14} /> {copied ? "Copiado" : "Copiar"}</button></div></div>}
      <button className="lumen-button lumen-button-primary" onClick={onGenerate} disabled={isGenerating}>{isGenerating ? <><RefreshCw className="spin" size={15} /> Generando…</> : <><Plus size={15} /> Generar código temporal</>}</button>
      <div className="lumen-cli-block"><span className="lumen-eyebrow">DESPUÉS DE DESCARGAR EL PAQUETE</span><code>lumen-agent pair --server-url &lt;URL&gt; --pairing-code &lt;CÓDIGO&gt;</code><small>El agente solo comunica presencia en esta primera versión; no puede ejecutar acciones o comandos.</small></div>
    </Panel>
    <Panel title="Dispositivos emparejados" eyebrow={`${rows.filter(row => row.status === "active").length} ACTIVOS`}>
      {isLoading ? <div className="lumen-inline-loading"><div className="lumen-spinner" /> Cargando dispositivos…</div> : rows.length ? <div className="lumen-device-list">{rows.map(device => <div className="lumen-device-row" key={device.id}><span className="lumen-device-icon"><Cpu size={17} /></span><div className="lumen-device-info"><strong>{device.name}</strong><small>{device.lastSeenAt ? `Última señal ${formatDate(device.lastSeenAt)}` : `Emparejado ${formatDate(device.createdAt)} · sin señal todavía`}</small></div><Badge kind={device.status === "active" ? "good" : "neutral"}>{device.status === "active" ? "Activo" : "Revocado"}</Badge>{device.status === "active" && <button className="lumen-icon-button danger" disabled={isRevoking} onClick={() => onRevoke(device.id)} title="Revocar acceso" aria-label={`Revocar acceso de ${device.name}`}><X size={15} /></button>}</div>)}</div> : <EmptyState icon={Cpu} title="No hay agentes conectados" detail="Empareja un dispositivo local cuando estés listo. La integración no se activa por sí sola." />}
      <div className="lumen-security-footnote"><LockKeyhole size={14} /> Puedes revocar el acceso desde aquí; los tokens no se muestran nuevamente.</div>
    </Panel>
  </div>;
}

function AssistantPanel({ ask, isAsking, error }: { ask: (message: string) => Promise<{ text: string }>; isAsking: boolean; error: string }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const hasMessages = messages.length > 0;
  const placeholder = useMemo(() => hasMessages ? "Continúa la conversación…" : "¿Qué te gustaría pensar u organizar?", [hasMessages]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isAsking) return;
    setMessages(previous => [...previous, { role: "user", text: message }]);
    setDraft("");
    try {
      const result = await ask(message);
      setMessages(previous => [...previous, { role: "assistant", text: result.text }]);
    } catch {
      setMessages(previous => [...previous, { role: "assistant", text: "No pude responder ahora. Tu mensaje no ejecutó ni cambió ninguna acción; intenta de nuevo más tarde." }]);
    }
  };
  return <Panel title="Habla con Lumen" eyebrow="ASISTENCIA SIN ACCIONES AUTOMÁTICAS" className="lumen-chat-panel">
    <div className="lumen-chat-header"><span className="lumen-chat-orb"><Sparkles size={17} /></span><div><strong>Asistente personal supervisado</strong><small>Sin herramientas de ejecución conectadas</small></div><Badge kind="good">Listo</Badge></div>
    {hasMessages && <div className="lumen-chat-messages" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`lumen-chat-message ${message.role}`}><span>{message.role === "assistant" ? "L" : userInitial(message.text)}</span><p>{message.text}</p></div>)}{isAsking && <div className="lumen-chat-pending"><span /><span /><span /> Lumen está pensando</div>}</div>}
    {!hasMessages && <div className="lumen-chat-suggestions"><span>Prueba preguntar:</span><button onClick={() => setDraft("Ayúdame a organizar las prioridades de esta semana.")}>Organizar prioridades <ArrowUpRight size={13} /></button><button onClick={() => setDraft("¿Qué información debería reunir antes de aprobar un gasto importante?")}>Preparar una decisión <ArrowUpRight size={13} /></button></div>}
    <form className="lumen-chat-form" onSubmit={submit}><textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={2} placeholder={placeholder} aria-label="Mensaje para Lumen" /><div><span>La respuesta no realiza pagos ni controla dispositivos.</span><button className="lumen-button lumen-button-primary" disabled={isAsking || !draft.trim()}>{isAsking ? <><RefreshCw className="spin" size={15} /> Pensando</> : <><MessageCircle size={15} /> Preguntar</>}</button></div></form>
    {error && <small className="lumen-inline-error">No se pudo conectar con el asistente: {error}</small>}
  </Panel>;
}

function userInitial(value: string) { return value.trim().slice(0, 1).toUpperCase() || "T"; }

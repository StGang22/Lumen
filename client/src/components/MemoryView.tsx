import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Check, Pencil, Plus, Trash2, X } from "lucide-react";

type MemoryContext = "personal" | "home" | "business";
type MemoryKind = "preference" | "pending";
export type MemoryEntry = {
  id: string;
  context: MemoryContext;
  kind: MemoryKind;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};
type MemoryInput = { context: MemoryContext; kind: MemoryKind; title: string; content: string };

const contextName: Record<MemoryContext, string> = { personal: "Personal", home: "Hogar", business: "Empresa" };
const kindName: Record<MemoryKind, string> = { preference: "Preferencia", pending: "Pendiente" };

export default function MemoryView({ rows, isLoading, isSaving, onCreate, onUpdate, onDelete }: {
  rows: MemoryEntry[];
  isLoading: boolean;
  isSaving: boolean;
  onCreate: (input: MemoryInput) => void;
  onUpdate: (input: MemoryInput & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [context, setContext] = useState<MemoryContext>("personal");
  const [kind, setKind] = useState<MemoryKind>("preference");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!editing) return;
    setContext(editing.context);
    setKind(editing.kind);
    setTitle(editing.title);
    setContent(editing.content);
  }, [editing]);

  const reset = () => { setEditing(null); setContext("personal"); setKind("preference"); setTitle(""); setContent(""); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = { context, kind, title: title.trim(), content: content.trim() };
    if (editing) onUpdate({ id: editing.id, ...input });
    else onCreate(input);
    reset();
  };
  const date = (value: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(value instanceof Date ? value : new Date(value));

  return <div className="lumen-page-grid">
    <section className="lumen-panel lumen-form-panel">
      <div className="lumen-panel-head"><div><span className="lumen-eyebrow">MEMORIA BAJO TU CONTROL</span><h2>{editing ? "Editar una nota" : "Guardar una nota"}</h2></div><BookOpen size={17} color="#8d793f" /></div>
      <form className="lumen-form" onSubmit={submit}>
        <div className="lumen-form-grid">
          <label>Ámbito<select value={context} onChange={event => setContext(event.target.value as MemoryContext)}><option value="personal">Personal</option><option value="home">Hogar</option><option value="business">Empresa</option></select></label>
          <label>Tipo<select value={kind} onChange={event => setKind(event.target.value as MemoryKind)}><option value="preference">Preferencia</option><option value="pending">Pendiente</option></select></label>
        </div>
        <label>Título<input value={title} onChange={event => setTitle(event.target.value)} minLength={2} maxLength={120} required placeholder="Ej. Prefiero un resumen breve por la mañana" /></label>
        <label>Nota<textarea value={content} onChange={event => setContent(event.target.value)} minLength={2} maxLength={2500} required rows={4} placeholder="Escribe solo información que quieras conservar como contexto." /></label>
        <div className="lumen-form-note"><BookOpen size={15} /><span>Estas notas solo se incluyen como contexto cuando usas el chat de Lumen. Evita guardar contraseñas, tokens o datos médicos identificables. Puedes editar o borrar cada nota.</span></div>
        <div className="lumen-memory-form-actions"><button className="lumen-button lumen-button-primary" disabled={isSaving}>{isSaving ? "Guardando…" : editing ? <><Check size={15} /> Guardar cambios</> : <><Plus size={15} /> Guardar nota</>}</button>{editing && <button type="button" className="lumen-button lumen-button-quiet" onClick={reset}><X size={15} /> Cancelar</button>}</div>
      </form>
    </section>
    <section className="lumen-panel">
      <div className="lumen-panel-head"><div><span className="lumen-eyebrow">PREFERENCIAS Y PENDIENTES</span><h2>Notas guardadas</h2></div><span className="lumen-memory-count">{rows.length}</span></div>
      {isLoading ? <div className="lumen-inline-loading"><div className="lumen-spinner" /> Cargando memoria…</div> : rows.length ? <div className="lumen-memory-list">{rows.map(note => <article className="lumen-memory-item" key={note.id}>
        <div className="lumen-memory-item-head"><span className="lumen-memory-kind">{kindName[note.kind]}</span><span className="lumen-memory-context">{contextName[note.context]}</span><span className="lumen-memory-date">{date(note.updatedAt)}</span></div>
        <h3>{note.title}</h3><p>{note.content}</p>
        <div className="lumen-memory-actions"><button className="lumen-button lumen-button-quiet" onClick={() => setEditing(note)}><Pencil size={13} /> Editar</button><button className="lumen-button lumen-button-quiet lumen-delete-button" onClick={() => { if (window.confirm(`¿Eliminar la nota “${note.title}” de la memoria de Lumen?`)) onDelete(note.id); }}><Trash2 size={13} /> Eliminar</button></div>
      </article>)}</div> : <div className="lumen-empty"><span className="lumen-empty-icon"><BookOpen size={19} /></span><strong>Memoria vacía</strong><p>Añade preferencias o pendientes que quieras que Lumen tenga en cuenta. No se guarda nada automáticamente desde el chat.</p></div>}
    </section>
  </div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiCheck, FiCheckCircle, FiPlus, FiSave, FiTrash2 } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { getStarterMessageTemplates, isValidMessageTemplate, messageTemplateVariables, renderMessageTemplate, type MessageTemplate } from "@/features/scheduling/message-templates";
import type { Locale, Service } from "@/features/scheduling/types";
import { deleteMessageTemplate, getMessageTemplates, saveMessageTemplate } from "@/lib/networking/endpoints/message-templates";

const copy = {
  es: {
    eyebrow: "Comunicación", title: "Mensajes de WhatsApp", description: "Prepará tus mensajes de WhatsApp, copialos y compartilos con tus clientes.",
    starters: "Para empezar", saved: "Mis plantillas", new: "Crear plantilla", editor: "Personalizá tu mensaje", name: "Nombre de la plantilla", body: "Mensaje",
    variables: "Insertar datos del negocio", variableHint: "Estos datos se completan automáticamente en la vista previa y al copiar.",
    target: "Link para compartir", catalog: "Catálogo del negocio", service: "Elegí un servicio para completar su nombre y link.",
    save: "Guardar plantilla", saveCopy: "Guardar como nueva", remove: "Eliminar", cancel: "Cancelar", deleteTitle: "¿Eliminar esta plantilla?",
    deleteHint: "Se eliminará de las plantillas guardadas de tu negocio.", preview: "Vista previa", previewHint: "Así se verá el texto. Copialo y pegalo en tu chat de WhatsApp.",
    copy: "Copiar mensaje", copying: "Copiando…", copied: "¡Copiado!", copyError: "No pudimos copiarlo. Seleccioná y copiá el texto de la vista previa.",
    loadError: "No pudimos cargar tus plantillas guardadas. Podés usar las de ejemplo y copiar mensajes mientras tanto.", retry: "Reintentar",
    saveError: "No pudimos guardar la plantilla. Intentá de nuevo.", deleteError: "No pudimos eliminar la plantilla.", savedNotice: "Plantilla guardada.", deletedNotice: "Plantilla eliminada.",
    loading: "Cargando tus plantillas…", empty: "Todavía no guardaste plantillas. Personalizá una de ejemplo o creá la tuya.",
    validation: "Completá un nombre (hasta 80 caracteres) y un mensaje (hasta 3000).", noSlug: "Configurá el link público de tu negocio en Perfil antes de copiar el mensaje.",
    manual: "El envío lo hacés vos desde WhatsApp. Esta herramienta no envía mensajes automáticamente.", online: "Tu negocio", draftName: "Mi mensaje", missingService: "Elegí un servicio para usar {{servicio}}.",
    unsaved: "Tenés cambios sin guardar. ¿Querés descartarlos para cambiar de plantilla?"
  },
  en: {
    eyebrow: "Communication", title: "WhatsApp messages", description: "Prepare your WhatsApp messages, copy them and share them with customers.",
    starters: "Get started", saved: "My templates", new: "Create template", editor: "Customize your message", name: "Template name", body: "Message",
    variables: "Insert business details", variableHint: "These values are filled automatically in the preview and copied message.",
    target: "Link to share", catalog: "Business catalog", service: "Choose a service to fill its name and link.",
    save: "Save template", saveCopy: "Save as new", remove: "Delete", cancel: "Cancel", deleteTitle: "Delete this template?",
    deleteHint: "It will be removed from your business's saved templates.", preview: "Preview", previewHint: "This is the message text. Copy it and paste it into your WhatsApp chat.",
    copy: "Copy message", copying: "Copying…", copied: "Copied!", copyError: "Unable to copy. Select and copy the preview text manually.",
    loadError: "Unable to load your saved templates. You can still use the examples and copy messages.", retry: "Retry",
    saveError: "Unable to save the template. Please try again.", deleteError: "Unable to delete the template.", savedNotice: "Template saved.", deletedNotice: "Template deleted.",
    loading: "Loading your templates…", empty: "No saved templates yet. Customize an example or create your own.",
    validation: "Enter a name (up to 80 characters) and a message (up to 3000).", noSlug: "Configure your business's public link in Profile before copying the message.",
    manual: "Send the message yourself in WhatsApp. This tool does not send messages automatically.", online: "Your business", draftName: "My message", missingService: "Choose a service to use {{servicio}}.",
    unsaved: "You have unsaved changes. Discard them and switch templates?"
  }
};

type MessageTemplatesViewProps = { businessId: string; businessName: string; businessSlug: string; services: Service[]; locale: Locale };

export function MessageTemplatesView({ businessId, businessName, businessSlug, services, locale }: MessageTemplatesViewProps) {
  const text = copy[locale];
  const starters = getStarterMessageTemplates(locale);
  const [draft, setDraft] = useState<MessageTemplate>(starters[0]);
  const baseline = useRef(starters[0]);
  const [saved, setSaved] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");
  const [copyError, setCopyError] = useState("");
  const copyTimers = useRef<number[]>([]);
  const copyActive = useRef(false);
  const copyMounted = useRef(true);
  const [origin, setOrigin] = useState("");
  const [serviceId, setServiceId] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const availableServices = services.filter((service) => service.isVisible && !service.isArchived);
  const service = availableServices.find((item) => item.id === serviceId);
  const link = origin && businessSlug ? `${origin}/${encodeURIComponent(businessSlug)}${service ? `/${encodeURIComponent(service.publicSlug || service.id)}` : ""}` : "";
  const preview = renderMessageTemplate(draft.body, { negocio: businessName, link, servicio: service?.name ?? "" });
  const isSaved = saved.some((item) => item.id === draft.id);
  const missingService = draft.body.includes("{{servicio}}") && !service;

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setOrigin(window.location.origin);
      setIsLoading(true);
      void getMessageTemplates(businessId).then((items) => {
        if (active) { setSaved(items); setLoadFailed(false); }
      }).catch(() => {
        if (active) setLoadFailed(true);
      }).finally(() => { if (active) setIsLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [businessId, loadAttempt]);

  useEffect(() => {
    copyMounted.current = true;
    return () => {
      copyMounted.current = false;
      copyTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function selectTemplate(template: MessageTemplate) {
    const changed = draft.title !== baseline.current.title || draft.body !== baseline.current.body;
    if (changed && !window.confirm(text.unsaved)) return;
    baseline.current = template;
    setDraft(template);
    setNotice(""); setError("");
  }

  function insertVariable(variable: string) {
    const field = inputRef.current;
    const start = field?.selectionStart ?? draft.body.length;
    const end = field?.selectionEnd ?? start;
    const token = `{{${variable}}}`;
    const nextBody = draft.body.slice(0, start) + token + draft.body.slice(end);
    if (nextBody.length > 3000) return;
    setDraft({ ...draft, body: nextBody });
    window.requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + token.length, start + token.length); });
  }

  async function save(asNew = false) {
    setNotice(""); setError("");
    if (!isValidMessageTemplate(draft.title, draft.body)) { setError(text.validation); return; }
    setBusy(true);
    const template = { ...draft, id: isSaved && !asNew ? draft.id : crypto.randomUUID(), title: draft.title.trim(), body: draft.body.trim() };
    try {
      await saveMessageTemplate(businessId, template);
      setSaved((items) => [template, ...items.filter((item) => item.id !== template.id)]);
      baseline.current = template; setDraft(template); setNotice(text.savedNotice);
    } catch { setError(text.saveError); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError("");
    try {
      await deleteMessageTemplate(businessId, draft.id);
      setSaved((items) => items.filter((item) => item.id !== draft.id));
      baseline.current = starters[0]; setDraft(starters[0]); setDeleteOpen(false); setNotice(text.deletedNotice);
    } catch { setError(text.deleteError); setDeleteOpen(false); }
    finally { setBusy(false); }
  }

  async function copyMessage() {
    if (copyActive.current) return;
    copyActive.current = true;
    copyTimers.current.forEach((timer) => window.clearTimeout(timer));
    setCopyError("");
    setCopyState("copying");
    const startedAt = Date.now();
    try {
      await navigator.clipboard.writeText(preview);
      if (!copyMounted.current) return;
      copyTimers.current = [window.setTimeout(() => {
        setCopyState("copied");
        copyTimers.current = [window.setTimeout(() => {
          setCopyState("idle");
          copyActive.current = false;
        }, 1800)];
      }, Math.max(0, 400 - (Date.now() - startedAt)))];
    } catch {
      if (!copyMounted.current) return;
      setCopyState("idle");
      copyActive.current = false;
      setCopyError(text.copyError);
    }
  }

  return (
    <div className="grid gap-6">
      <SectionHeader icon={<FaWhatsapp className="text-success" />} eyebrow={text.eyebrow} title={text.title} description={text.description} actions={<Button icon={<FiPlus />} disabled={busy} onClick={() => selectTemplate({ id: "new", title: text.draftName, body: "" })}>{text.new}</Button>} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div className="grid min-w-0 gap-5">
          <Card>
            <h2 className="text-sm font-bold text-primary">{text.starters}</h2>
            <div className="mt-3 flex flex-wrap gap-2">{starters.map((item) => <Button key={item.id} size="sm" variant={draft.id === item.id ? "primary" : "secondary"} disabled={busy} onClick={() => selectTemplate(item)}>{item.title}</Button>)}</div>
            <div className="mt-5 border-t border-subtle pt-4">
              <h2 className="text-sm font-bold text-primary">{text.saved}</h2>
              {isLoading ? <p role="status" className="mt-3 animate-pulse text-sm text-muted">{text.loading}</p> : loadFailed ? <div className="mt-3 grid gap-2"><p role="alert" className="text-sm text-danger">{text.loadError}</p><Button size="sm" variant="secondary" onClick={() => setLoadAttempt((value) => value + 1)}>{text.retry}</Button></div> : saved.length ? <div className="mt-3 flex flex-wrap gap-2">{saved.map((item) => <Button key={item.id} size="sm" variant={draft.id === item.id ? "primary" : "secondary"} disabled={busy} onClick={() => selectTemplate(item)} className="max-w-full"><span className="truncate">{item.title}</span></Button>)}</div> : <p className="mt-3 text-sm leading-6 text-muted">{text.empty}</p>}
            </div>
          </Card>
          <Card className="grid gap-4">
            <h2 className="text-lg font-bold text-primary">{text.editor}</h2>
            <TextField name="template-title" label={text.name} value={draft.title} maxLength={80} disabled={busy} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            <SelectField name="template-service" label={text.target} value={serviceId} onChange={(event) => setServiceId(event.target.value)} options={[{ value: "", label: text.catalog }, ...availableServices.map((item) => ({ value: item.id, label: item.name }))]} />
            <div><p className="text-xs font-semibold text-muted">{text.variables}</p><div className="mt-2 flex flex-wrap gap-2">{messageTemplateVariables.map((variable) => <Button key={variable} size="sm" variant="secondary" disabled={busy} onClick={() => insertVariable(variable)}>{`{{${variable}}}`}</Button>)}</div><p className="mt-2 text-xs leading-5 text-muted">{text.variableHint}</p></div>
            <TextAreaField name="template-body" label={text.body} value={draft.body} maxLength={3000} disabled={busy} className="min-h-56" onChange={(event) => setDraft({ ...draft, body: event.target.value })} ref={inputRef} />
            <p className="text-right text-xs text-muted">{draft.body.length}/3000</p>
            {missingService ? <p className="text-sm text-warning">{text.missingService} {text.service}</p> : null}
            {!businessSlug ? <p className="text-sm text-warning">{text.noSlug}</p> : null}
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            {notice ? <p role="status" className="flex items-center gap-2 text-sm text-success"><FiCheckCircle aria-hidden="true" />{notice}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button icon={<FiSave />} isLoading={busy} disabled={isLoading || loadFailed} onClick={() => void save()}>{text.save}</Button>
              {isSaved ? <><Button variant="secondary" disabled={busy} onClick={() => void save(true)}>{text.saveCopy}</Button><Button variant="ghost" disabled={busy} icon={<FiTrash2 />} onClick={() => setDeleteOpen(true)}>{text.remove}</Button></> : null}
            </div>
          </Card>
        </div>
        <div className="grid gap-4 lg:sticky lg:top-6">
          <div><h2 className="text-lg font-bold text-primary">{text.preview}</h2><p className="mt-1 text-sm text-muted">{text.previewHint}</p></div>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border-4 border-subtle bg-shell shadow-lg">
            <div className="flex items-center gap-3 border-b border-subtle bg-success-soft px-4 py-5 text-success">
              <FiArrowLeft aria-hidden="true" /><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-xl"><FaWhatsapp aria-hidden="true" /></span><div className="min-w-0"><p className="truncate font-bold">{businessName}</p><p className="text-xs">{text.online}</p></div>
            </div>
            <div className="min-h-80 p-4">
              <div className={cx("ml-3 rounded-2xl rounded-tr-sm border border-success/15 bg-success-soft p-4 shadow-sm", !preview && "min-h-20")}>
                <p className="select-text whitespace-pre-wrap break-words text-sm leading-6 text-primary" dir="auto">
                  {preview.split(/(\*[^*\n]+\*)/g).map((part, index) => part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={index}>{part.slice(1, -1)}</strong> : part)}
                </p>
                <div className="mt-2 flex items-center justify-end gap-1 text-[0.65rem] text-muted"><span>12:00</span><FiCheck aria-hidden="true" /><FiCheck aria-hidden="true" /></div>
              </div>
            </div>
            <div className="mx-auto mb-3 h-1 w-20 rounded-full bg-subtle" />
          </div>
          <Button size="lg" icon={copyState === "copied" ? <FiCheck /> : <FaWhatsapp />} isLoading={copyState === "copying"} disabled={copyState !== "idle" || !draft.body.trim() || !businessSlug || !origin || missingService} aria-live="polite" onClick={() => void copyMessage()}>{copyState === "copying" ? text.copying : copyState === "copied" ? text.copied : text.copy}</Button>
          {copyError ? <p role="alert" className="text-center text-sm text-danger">{copyError}</p> : null}
          <p className="text-center text-xs leading-5 text-muted">{text.manual}</p>
        </div>
      </div>
      <Modal isOpen={deleteOpen}><h2 className="text-lg font-bold text-primary">{text.deleteTitle}</h2><p className="mt-3 text-sm text-muted">{text.deleteHint}</p><div className="mt-5 flex justify-end gap-3"><Button variant="secondary" autoFocus disabled={busy} onClick={() => setDeleteOpen(false)}>{text.cancel}</Button><Button variant="danger" isLoading={busy} onClick={() => void remove()}>{text.remove}</Button></div></Modal>
    </div>
  );
}

"use client";

import { KeyboardEvent, SelectHTMLAttributes, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown } from "react-icons/fi";

import { getSelectMenuPosition } from "@/components/ui/select-menu-position";
import { cx } from "@/components/ui/utils";
import { useDropdownMotion } from "@/components/ui/useDropdownMotion";

type SelectOption = { value: string; label: string; disabled?: boolean };
type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size"> & {
  label?: string;
  options: SelectOption[];
};

export function SelectField({ label, options, className, id, value, defaultValue, disabled, required, onChange, onInvalid, autoFocus, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? props.name ?? generatedId;
  const menuId = `${fieldId}-options`;
  const trigger = useRef<HTMLButtonElement>(null);
  const nativeSelect = useRef<HTMLSelectElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? options.find((option) => !option.disabled)?.value ?? ""));
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isInvalid, setIsInvalid] = useState(false);
  const [position, setPosition] = useState<ReturnType<typeof getSelectMenuPosition> | null>(null);
  const [themeClass, setThemeClass] = useState("");
  const currentValue = value !== undefined ? String(value) : uncontrolledValue;
  const selected = options.find((option) => option.value === currentValue) ?? options.find((option) => !option.disabled);
  const isExpanded = isOpen && !disabled && options.length > 0;
  if (isOpen && (disabled || !options.some((option) => !option.disabled))) setIsOpen(false);

  function closeMenu() {
    setIsOpen(false);
    search.current = { text: "", time: 0 };
  }

  function openMenu(index = options.findIndex((option) => option.value === selected?.value && !option.disabled)) {
    if (disabled || trigger.current?.matches(":disabled") || !options.some((option) => !option.disabled)) return;
    setActiveIndex(index >= 0 ? index : options.findIndex((option) => !option.disabled));
    setIsOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    const select = nativeSelect.current;
    if (!isExpanded || !option || option.disabled || !select || disabled || select.matches(":disabled")) return;
    if (select.value !== option.value) {
      // Dispatch a real change event so existing form handlers keep their native event contract.
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, option.value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closeMenu();
    trigger.current?.focus({ preventScroll: true });
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") { closeMenu(); return; }
    if (event.key === "Escape") {
      if (isExpanded) { event.preventDefault(); event.stopPropagation(); closeMenu(); }
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === "Enter" || event.key === " ") {
        if (isExpanded) choose(activeIndex); else openMenu();
        return;
      }
      const enabled = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
      if (!enabled.length) return;
      if (event.key === "Home") openMenu(enabled[0]);
      else if (event.key === "End") openMenu(enabled[enabled.length - 1]);
      else if (!isExpanded) openMenu();
      else {
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = (enabled.indexOf(activeIndex) + step + enabled.length) % enabled.length;
        setActiveIndex(enabled[next]);
      }
      return;
    }
    if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const now = Date.now();
    const text = (now - search.current.time > 700 ? "" : search.current.text) + event.key;
    search.current = { text, time: now };
    const prefix = [...text].every((letter) => letter === text[0]) ? text[0] : text;
    const normalize = (input: string) => input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    const start = prefix.length === 1 ? (isExpanded ? activeIndex : options.indexOf(selected!)) + 1 : Math.max(activeIndex, 0);
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + offset + options.length) % options.length;
      if (!options[index].disabled && normalize(options[index].label).startsWith(normalize(prefix))) { openMenu(index); break; }
    }
  }

  useLayoutEffect(() => {
    if (!isExpanded) return;
    function updatePosition() {
      const button = trigger.current;
      if (!button) return;
      if (button.matches(":disabled") || button.closest("[inert]")) { setIsOpen(false); return; }
      const rect = button.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setIsOpen(false); return; }
      const height = menu.current?.offsetWidth ? menu.current.scrollHeight : options.length * 36 + 8;
      const next = getSelectMenuPosition(rect, window.innerWidth, window.innerHeight, height);
      setPosition((previous) => previous && Object.keys(next).every((key) => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
      const themeRoot = button.closest(".theme-coral, .theme-blue, .theme-sage");
      setThemeClass(Array.from(themeRoot?.classList ?? []).find((name) => /^theme-(coral|blue|sage)$/.test(name)) ?? "");
    }
    updatePosition();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    if (trigger.current) resizeObserver?.observe(trigger.current);
    if (menu.current) resizeObserver?.observe(menu.current);
    const modalOverlay = trigger.current?.closest('[role="dialog"]')?.parentElement;
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(updatePosition);
    if (modalOverlay) mutationObserver?.observe(modalOverlay, { attributes: true, attributeFilter: ["inert"] });
    const fieldset = trigger.current?.closest("fieldset");
    if (fieldset) mutationObserver?.observe(fieldset, { attributes: true, attributeFilter: ["disabled"] });
    function outsidePointer(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) closeMenu();
    }
    document.addEventListener("pointerdown", outsidePointer, true);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      resizeObserver?.disconnect(); mutationObserver?.disconnect();
      document.removeEventListener("pointerdown", outsidePointer, true);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isExpanded, options]);

  useLayoutEffect(() => {
    if (isExpanded) menu.current?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [isExpanded, activeIndex]);

  useEffect(() => {
    const select = nativeSelect.current;
    const form = select?.form;
    if (!form) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function reset() {
      closeMenu(); setIsInvalid(false);
      timeout = setTimeout(() => setUncontrolledValue(select?.value ?? ""), 0);
    }
    form.addEventListener("reset", reset);
    return () => { form.removeEventListener("reset", reset); clearTimeout(timeout); };
  }, []);

  const { isPresent } = useDropdownMotion({ isOpen: isExpanded, triggerRef: trigger, contentRef: menu, ready: position !== null });

  return (
    <div className="grid gap-2 text-sm font-medium text-primary">
      {label ? <label id={`${fieldId}-label`} htmlFor={fieldId}>{label}{required ? <span className="ml-1 text-danger">*</span> : null}</label> : null}
      <div className="relative">
        <button
          ref={trigger}
          id={fieldId}
          type="button"
          role="combobox"
          autoFocus={autoFocus}
          disabled={disabled}
          tabIndex={props.tabIndex}
          title={props.title}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"] ?? (label && !props["aria-label"] ? `${fieldId}-label` : undefined)}
          aria-describedby={props["aria-describedby"]}
          aria-invalid={props["aria-invalid"] ?? (isInvalid || undefined)}
          aria-required={required}
          aria-haspopup="listbox"
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? menuId : undefined}
          aria-activedescendant={isExpanded && options[activeIndex] && !options[activeIndex].disabled ? `${menuId}-${activeIndex}` : undefined}
          className={cx(
            "h-11 w-full cursor-pointer appearance-none rounded-lg border border-subtle bg-input px-3 pr-10 text-left text-sm text-primary outline-none transition-colors",
            "focus:border-brand focus:ring-2 focus:ring-focus disabled:cursor-not-allowed",
            className
          )}
          onClick={() => { if (isExpanded) closeMenu(); else openMenu(); }}
          onKeyDown={onTriggerKeyDown}
          onBlur={() => closeMenu()}
        >
          <span className="block truncate">{selected?.label ?? ""}</span>
          <FiChevronDown className={cx("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-muted transition-transform motion-reduce:transition-none", isExpanded && "rotate-180")} aria-hidden="true" />
        </button>
        <select
          {...props}
          ref={nativeSelect}
          id={`${fieldId}-native`}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none sr-only"
          onChange={(event) => { setUncontrolledValue(event.currentTarget.value); setIsInvalid(!event.currentTarget.validity.valid); onChange?.(event); }}
          onInvalid={(event) => { event.preventDefault(); setIsInvalid(true); trigger.current?.focus(); onInvalid?.(event); }}
        >
          {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>
      </div>
      {isPresent && typeof document !== "undefined" ? createPortal(
        <div
          ref={menu}
          inert={!isExpanded}
          aria-hidden={!isExpanded || undefined}
          id={menuId}
          role="listbox"
          aria-label={props["aria-label"] ?? label}
          aria-labelledby={props["aria-labelledby"] ?? (!label && !props["aria-label"] ? fieldId : undefined)}
          className={cx(
            "fixed z-[100] overflow-y-auto overscroll-contain rounded-lg border border-subtle bg-surface p-1 shadow-lg motion-reduce:animate-none",
            themeClass,
            !position && "invisible",
            !isExpanded && "pointer-events-none opacity-0"
          )}
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, width: position?.width ?? 0, maxHeight: position?.maxHeight ?? 256 }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => <button
            key={option.value}
            id={`${menuId}-${index}`}
            type="button"
            role="option"
            tabIndex={-1}
            data-option-index={index}
            aria-selected={option.value === selected?.value}
            aria-disabled={Boolean(option.disabled)}
            disabled={option.disabled}
            className={cx(
              "flex min-h-9 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:text-muted disabled:opacity-50",
              option.value === selected?.value ? "bg-brand-soft font-semibold text-brand-strong" : "text-primary",
              index === activeIndex && option.value !== selected?.value && "bg-input"
            )}
            onPointerMove={(event) => { if (event.pointerType === "mouse" && !option.disabled) setActiveIndex(index); }}
            onClick={() => choose(index)}
          >
            <span className="min-w-0 break-words">{option.label}</span>
            {option.value === selected?.value ? <FiCheck className="shrink-0" aria-hidden="true" /> : null}
          </button>)}
        </div>, document.body
      ) : null}
    </div>
  );
}

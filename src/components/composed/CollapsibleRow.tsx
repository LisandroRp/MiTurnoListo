"use client";

import { type ReactNode, type RefObject, useId, useLayoutEffect, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/utils";

type CollapsibleRowProps = {
  heightReference: RefObject<HTMLDivElement | null>;
  title: string;
  expandLabel: string;
  collapseLabel: string;
  children: ReactNode;
};

export function CollapsibleRow({ heightReference, title, expandLabel, collapseLabel, children }: CollapsibleRowProps) {
  const id = useId();
  const headingRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [heights, setHeights] = useState({ collapsed: 0, full: 0 });
  const canExpand = heights.full > heights.collapsed + 1;

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    function measure() {
      if (!content) return;
      const items = Array.from(content.children) as HTMLElement[];
      const full = content.scrollHeight;
      const available = Math.max(0, (heightReference.current?.offsetHeight ?? 0) - (headingRef.current?.offsetHeight ?? 0) - 8);
      const collapsed = available || full;
      setHeights((current) => current.collapsed === collapsed && current.full === full ? current : { collapsed, full });
      items.forEach((item) => { item.inert = !isExpanded && item.offsetTop + item.offsetHeight > collapsed; });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    if (heightReference.current) observer.observe(heightReference.current);
    if (headingRef.current) observer.observe(headingRef.current);
    return () => {
      observer.disconnect();
      Array.from(content.children).forEach((item) => { (item as HTMLElement).inert = false; });
    };
  }, [children, heightReference, isExpanded]);

  return (
    <div className="min-w-0 flex-1">
      <div ref={headingRef} className="flex min-h-8 items-center gap-3">
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        {canExpand ? <Button size="icon" variant="secondary" className="!h-8 !w-8 rounded-full" aria-label={isExpanded ? collapseLabel : expandLabel} aria-expanded={isExpanded} aria-controls={id} onClick={() => setIsExpanded((value) => !value)}><FiChevronDown aria-hidden="true" className={cx("transition-transform duration-300 motion-reduce:transition-none", isExpanded && "rotate-180")} /></Button> : null}
      </div>
      <div id={id} className="relative mt-2 overflow-hidden transition-[height] duration-300 ease-in-out motion-reduce:transition-none" style={{ height: heights.full ? (isExpanded ? heights.full : Math.min(heights.full, heights.collapsed)) : undefined }}>
        <div ref={contentRef} className="relative flex max-w-4xl flex-wrap gap-2 p-0.5">{children}</div>
        {canExpand ? <div aria-hidden="true" className={cx("pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface via-surface/60 via-35% to-surface/0 transition-opacity duration-300 motion-reduce:transition-none", isExpanded ? "opacity-0" : "opacity-100")} /> : null}
      </div>
    </div>
  );
}

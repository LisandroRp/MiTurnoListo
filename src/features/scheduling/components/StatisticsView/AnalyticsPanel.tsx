import { ReactNode, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FiChevronDown } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";

type AnalyticsPanelProps = {
  title: string;
  description: string;
  controls: { expandPanel: string; collapsePanel: string };
  children: ReactNode | ((isExpanded: boolean) => ReactNode);
};

type PanelLayout = {
  elements: Map<HTMLElement, DOMRect>;
  container: HTMLElement | null;
  containerBounds: DOMRect | null;
};

function captureLayout(panel: HTMLElement): PanelLayout {
  const container = panel.parentElement;
  return {
    elements: new Map(Array.from(container?.children ?? []).map((element) => [element as HTMLElement, element.getBoundingClientRect()])),
    container,
    containerBounds: container?.getBoundingClientRect() ?? null
  };
}

function movementFrames(previous: DOMRect, next: DOMRect): Keyframe[] {
  const x = previous.left - next.left;
  const y = previous.top - next.top;
  const frames: Keyframe[] = [{ transform: `translate(${x}px, ${y}px)` }];
  if (x !== 0 && y !== 0) {
    frames.push({ transform: y > 0 ? `translate(0, ${y}px)` : `translate(${x}px, 0)`, offset: 0.4 });
  }
  frames.push({ transform: "translate(0, 0)" });
  return frames;
}

function isLeftColumn(bounds: DOMRect, container: DOMRect | null) {
  return container !== null && Math.abs(bounds.left - container.left) < 1 && bounds.width < container.width - 1;
}

function animateLayout(previous: PanelLayout, excluded?: HTMLElement, returnBelow?: HTMLElement, duration = 500) {
  const animations: Animation[] = [];
  const returningPanelBounds = returnBelow ? previous.elements.get(returnBelow) : undefined;
  previous.elements.forEach((bounds, element) => {
    if (element === excluded || typeof element.animate !== "function") return;
    const next = element.getBoundingClientRect();
    if (bounds.left === next.left && bounds.top === next.top) return;
    animations.push(element.animate(movementFrames(bounds, next), {
      duration,
      delay: returningPanelBounds && bounds.top > returningPanelBounds.top ? 200 : 0,
      easing: "ease-in-out",
      fill: "backwards"
    }));
  });
  const { container, containerBounds } = previous;
  if (container && containerBounds && typeof container.animate === "function") {
    const next = container.getBoundingClientRect();
    if (Math.abs(containerBounds.height - next.height) > 1) {
      animations.push(container.animate([
        { height: `${containerBounds.height}px` },
        { height: `${next.height}px` }
      ], { duration, delay: returningPanelBounds ? 200 : 0, easing: "ease-in-out", fill: "backwards" }));
    }
  }
  return animations;
}

export function AnalyticsPanel({ title, description, controls, children }: AnalyticsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [hasMoreContent, setHasMoreContent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);
  const previousBounds = useRef<DOMRect | null>(null);
  const previousLayout = useRef<PanelLayout | null>(null);
  const releaseLayout = useRef<{ layout: PanelLayout; pauseBelow: boolean } | null>(null);
  const id = useId();
  const titleId = `${id}-title`;

  useLayoutEffect(() => {
    const content = contentRef.current;
    const inner = innerContentRef.current;
    if (!content || !inner || isExpanded) return;

    function measureOverflow() {
      if (!content) return;
      setHasOverflow(content.scrollHeight > content.clientHeight + 1);
      setHasMoreContent(content.scrollHeight - content.clientHeight - content.scrollTop > 1);
    }

    const frame = window.requestAnimationFrame(measureOverflow);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureOverflow);
    observer?.observe(content);
    observer?.observe(inner);
    content.addEventListener("scroll", measureOverflow, { passive: true });
    window.addEventListener("resize", measureOverflow);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      content.removeEventListener("scroll", measureOverflow);
      window.removeEventListener("resize", measureOverflow);
    };
  }, [children, isExpanded]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const previous = previousBounds.current;
    previousBounds.current = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!window.matchMedia("(min-width: 1280px)").matches) {
      releaseLayout.current = null;
      if (!panel || !previous || typeof panel.animate !== "function" || reducedMotion) return;
      const next = panel.getBoundingClientRect();
      const animation = panel.animate([
        { height: `${previous.height}px`, overflow: "hidden" },
        { height: `${next.height}px`, overflow: "hidden" }
      ], { duration: 400, easing: "ease-in-out" });
      return () => animation.cancel();
    }

    if (releaseLayout.current) {
      const { layout, pauseBelow } = releaseLayout.current;
      releaseLayout.current = null;
      const returnDuration = panel && isLeftColumn(panel.getBoundingClientRect(), layout.containerBounds) ? 200 : 500;
      const animations = reducedMotion ? [] : animateLayout(layout, undefined, pauseBelow ? panel ?? undefined : undefined, returnDuration);
      return () => animations.forEach((animation) => animation.cancel());
    }

    if (!panel || !previous || typeof panel.animate !== "function" || reducedMotion) {
      return;
    }

    const card = panel.firstElementChild as HTMLElement | null;
    if (!card || typeof card.animate !== "function") return;

    const previousColumn = panel.style.gridColumn;
    const previousHeight = panel.style.height;
    if (!isExpanded) {
      panel.style.gridColumn = "auto";
      panel.style.height = "28rem";
    }
    const next = panel.getBoundingClientRect();
    panel.style.gridColumn = previousColumn;
    const needsClosingClearance = !isExpanded && next.height > previous.height;
    panel.style.height = `${isExpanded ? next.height : needsClosingClearance ? next.height + 24 : previous.height}px`;

    const opensFromLeft = isExpanded && isLeftColumn(previous, previousLayout.current?.containerBounds ?? null);
    const peerDuration = opensFromLeft ? 700 : 500;
    const peers = (isExpanded || needsClosingClearance) && previousLayout.current ? animateLayout(previousLayout.current, panel, undefined, peerDuration) : [];
    const resizeDelay = peers.length > 0 ? opensFromLeft ? 350 : peerDuration : 0;
    const movement = isExpanded ? panel.animate(movementFrames(previous, next), {
      duration: 400,
      delay: resizeDelay,
      easing: "ease-in-out",
      fill: "backwards"
    }) : null;
    const animation = card.animate([
      {
        width: `${previous.width}px`,
        height: `${previous.height}px`,
        overflow: "hidden",
        zIndex: 1
      },
      { width: `${next.width}px`, height: `${next.height}px`, overflow: "hidden", zIndex: 1 }
    ], { duration: 400, delay: resizeDelay, easing: isExpanded ? "cubic-bezier(0.22, 1, 0.36, 1)" : "ease-in-out", fill: "both" });

    animation.onfinish = () => {
      if (!isExpanded) {
        releaseLayout.current = { layout: captureLayout(panel), pauseBelow: needsClosingClearance };
        flushSync(() => setIsWide(false));
      } else {
        panel.style.height = previousHeight;
        animation.cancel();
      }
    };

    return () => {
      animation.onfinish = null;
      animation.cancel();
      movement?.cancel();
      peers.forEach((peer) => peer.cancel());
      panel.style.height = previousHeight;
    };
  }, [isExpanded, isWide]);

  function toggleExpanded() {
    const panel = panelRef.current;
    previousBounds.current = panel?.firstElementChild?.getBoundingClientRect() ?? null;
    previousLayout.current = panel ? captureLayout(panel) : null;
    const next = !isExpanded;
    setIsExpanded(next);
    if (next || !panel || typeof panel.animate !== "function" || !window.matchMedia("(min-width: 1280px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) setIsWide(next);
  }

  return (
    <div ref={panelRef} className={cx("relative min-w-0", isWide && "xl:col-span-2", !isExpanded && !isWide && "h-[28rem]")}>
    <Card className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-subtle pb-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold text-primary">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
        {hasOverflow || isExpanded ? <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          aria-expanded={isExpanded}
          aria-controls={`${id}-content`}
          aria-label={`${isExpanded ? controls.collapsePanel : controls.expandPanel}: ${title}`}
          title={isExpanded ? controls.collapsePanel : controls.expandPanel}
          onClick={toggleExpanded}
          disabled={isWide !== isExpanded}
        >
          <FiChevronDown aria-hidden="true" className={cx("text-lg transition-transform", isExpanded && "rotate-180")} />
        </Button> : null}
      </div>
      <div className={cx("relative mt-5 min-h-0", !isExpanded && "flex flex-1 flex-col")}>
      <div
        ref={contentRef}
        id={`${id}-content`}
        role="region"
        aria-labelledby={titleId}
        tabIndex={0}
        className={cx("rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus", !isExpanded && "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1")}
      >
        <div ref={innerContentRef}>{typeof children === "function" ? children(isExpanded) : children}</div>
      </div>
      {!isExpanded ? <div aria-hidden="true" className={cx("pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface via-surface/60 via-35% to-surface/0 transition-opacity duration-300 motion-reduce:transition-none", hasMoreContent ? "opacity-100" : "opacity-0")} /> : null}
      </div>
    </Card>
    </div>
  );
}

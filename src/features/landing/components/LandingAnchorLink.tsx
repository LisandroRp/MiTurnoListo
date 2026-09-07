"use client";

import { MouseEvent, ReactNode } from "react";

type LandingAnchorLinkProps = {
  children: ReactNode;
  className?: string;
  targetId: string;
};

export function LandingAnchorLink({
  children,
  className,
  targetId
}: LandingAnchorLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    window.history.replaceState(null, "", `#${targetId}`);
  }

  return (
    <a href={`#${targetId}`} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}

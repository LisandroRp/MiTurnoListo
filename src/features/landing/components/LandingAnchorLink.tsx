"use client";

import { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

type LandingAnchorLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & {
  children: ReactNode;
  targetId: string;
};

export function LandingAnchorLink({
  children,
  className,
  targetId,
  ...props
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
    <a {...props} href={`#${targetId}`} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}

"use client";

import { useEffect, useState } from "react";

type LoadingDotsTextProps = {
  text: string;
};

export function LoadingDotsText({ text }: LoadingDotsTextProps) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setDotCount((current) => current === 3 ? 1 : current + 1);
    }, 420);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      {text}
      <span aria-hidden="true">{".".repeat(dotCount)}</span>
      <span className="sr-only">...</span>
    </>
  );
}

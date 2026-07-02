import Image from "next/image";

import { cx } from "@/components/ui/utils";

type BrandMarkProps = {
  variant?: "full" | "compact";
  size?: "sm" | "md" | "lg" | "xl";
  align?: "left" | "center";
  priority?: boolean;
  className?: string;
};

const fullSizeClasses = {
  full: {
    sm: "h-9 w-32 sm:w-36",
    md: "h-10 w-36 sm:w-40",
    lg: "h-14 w-44 sm:h-16 sm:w-52",
    xl: "h-16 w-48 sm:h-[4.5rem] sm:w-56"
  }
} as const;

const compactSizeConfig = {
  sm: {
    className: "h-8 w-8",
    intrinsicSize: 64,
    sizes: "32px"
  },
  md: {
    className: "h-10 w-10",
    intrinsicSize: 80,
    sizes: "40px"
  },
  lg: {
    className: "h-12 w-12",
    intrinsicSize: 96,
    sizes: "48px"
  },
  xl: {
    className: "h-24 w-24",
    intrinsicSize: 200,
    sizes: "96px"
  }
} as const;

export function BrandMark({
  variant = "full",
  size = "md",
  align = "left",
  priority = false,
  className
}: BrandMarkProps) {
  if (variant === "compact") {
    const compactSize = compactSizeConfig[size];

    return (
        <Image
          src="/branding/short-logo.png"
          alt="MiTurnoListo"
          width={compactSize.intrinsicSize}
          height={compactSize.intrinsicSize}
          priority={priority}
          className={cx("object-contain", compactSize.className, className)}
        />
    );
  }

  return (
    <span className={cx("relative block shrink-0", fullSizeClasses.full[size], className)}>
      <Image
        src="/branding/logo-wide.png"
        alt="MiTurnoListo"
        fill
        priority={priority}
        sizes="(max-width: 640px) 144px, 208px"
        className={cx(
          "object-contain",
          align === "center" ? "object-center" : "object-left"
        )}
      />
    </span>
  );
}

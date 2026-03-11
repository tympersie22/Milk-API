"use client";

import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  width?: string;
  height?: string;
};

export function Skeleton({ className, width, height, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}

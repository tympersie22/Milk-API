"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import { IconCopy, IconCheck } from "./icons";

type CodeBlockProps = {
  children: string;
  maxHeight?: string;
  className?: string;
};

export function CodeBlock({ children, maxHeight = "400px", className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className={cn("code-block-wrapper", className)}>
      <button className="code-copy-btn" onClick={copy} title="Copy">
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      </button>
      <pre className="code-block" style={{ maxHeight }}>
        {children}
      </pre>
    </div>
  );
}

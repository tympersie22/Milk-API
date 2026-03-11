import React from "react";
import { render, screen } from "@testing-library/react";
import { Badge } from "../../components/ui/badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies variant class", () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    const badge = container.querySelector(".badge");
    expect(badge?.className).toContain("badge-success");
  });

  it("defaults to neutral variant", () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.querySelector(".badge");
    expect(badge?.className).toContain("badge-neutral");
  });

  it("renders all variants without error", () => {
    const variants = ["success", "error", "warning", "info", "neutral"] as const;
    variants.forEach(v => {
      const { container } = render(<Badge variant={v}>{v}</Badge>);
      expect(container.querySelector(`.badge-${v}`)).toBeTruthy();
    });
  });
});

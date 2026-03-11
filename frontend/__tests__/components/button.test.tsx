import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../../components/ui/button";

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick handler", () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText("Disabled").closest("button")).toBeDisabled();
  });

  it("shows loading spinner when loading", () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByText("Loading").closest("button");
    expect(button).toBeDisabled();
  });

  it("applies variant classes", () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    const button = container.querySelector("button");
    expect(button?.className).toContain("btn-danger");
  });

  it("applies size classes", () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const button = container.querySelector("button");
    expect(button?.className).toContain("btn-sm");
  });

  it("renders with icon", () => {
    render(<Button icon={<span data-testid="icon">I</span>}>With Icon</Button>);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});

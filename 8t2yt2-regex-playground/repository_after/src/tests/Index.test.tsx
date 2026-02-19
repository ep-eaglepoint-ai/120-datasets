import React from "react";
import { render, screen } from "@testing-library/react";

import Index from "../pages/index";

describe("Index (Home page)", () => {
  it("renders the Regex Playground heading and description", () => {
    render(<Index />);

    expect(
      screen.getByRole("heading", { name: /regex playground/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/write, test, and debug regular expressions/i),
    ).toBeInTheDocument();
  });

  it("renders the RegexPlayground with pattern and test text inputs", () => {
    render(<Index />);

    expect(screen.getByLabelText("Pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Test Text")).toBeInTheDocument();
  });

  it("renders the client-side only footer", () => {
    render(<Index />);

    expect(screen.getByText(/client-side only/i)).toBeInTheDocument();
  });
});

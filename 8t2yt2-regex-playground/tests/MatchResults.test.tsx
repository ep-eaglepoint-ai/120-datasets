import React from "react";
import { render, screen } from "@testing-library/react";

import MatchResults from "../repository_after/src/components/MatchResults";

describe("MatchResults", () => {
  it("renders match metadata and nested capture groups", () => {
    render(
      <MatchResults
        matches={[
          {
            index: 4,
            end: 9,
            match: "café",
            groups: [
              {
                index: 1,
                name: "outer",
                text: "café",
                start: 4,
                end: 8,
                parentIndex: null,
              },
              {
                index: 2,
                name: "inner",
                text: "afé",
                start: 5,
                end: 8,
                parentIndex: 1,
              },
            ],
          },
        ]}
        executionTimeMs={2.5}
        truncated={false}
        status="idle"
      />,
    );

    expect(screen.getByText("1 match")).toBeInTheDocument();
    expect(screen.getByText("[4, 9)")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("(outer)")).toBeInTheDocument();
    expect(screen.getByText("parent #1")).toBeInTheDocument();
  });

  it("shows running status and truncation", () => {
    render(
      <MatchResults
        matches={[]}
        executionTimeMs={0.5}
        truncated
        status="running"
      />,
    );

    expect(screen.getByText("Running…")).toBeInTheDocument();
    expect(screen.getByText("Results truncated")).toBeInTheDocument();
  });

  it("shows regex error message", () => {
    render(
      <MatchResults
        matches={[]}
        executionTimeMs={0}
        truncated={false}
        error="Invalid regular expression"
        status="idle"
      />,
    );

    expect(screen.getByText("Regex Error")).toBeInTheDocument();
    expect(screen.getByText("Invalid regular expression")).toBeInTheDocument();
  });

  it("shows 0 matches and no matches to display message", () => {
    render(
      <MatchResults
        matches={[]}
        executionTimeMs={0.12}
        truncated={false}
        status="idle"
      />,
    );

    expect(screen.getByText("0 matches")).toBeInTheDocument();
    expect(
      screen.getByText(/No matches to display. Adjust your pattern/i),
    ).toBeInTheDocument();
  });

  it("renders execution time with two decimal places", () => {
    render(
      <MatchResults
        matches={[{ index: 0, end: 1, match: "a", groups: [] }]}
        executionTimeMs={1.256}
        truncated={false}
        status="idle"
      />,
    );

    expect(screen.getByText("Execution: 1.26ms")).toBeInTheDocument();
  });

  it("renders optional/empty group text as (empty)", () => {
    render(
      <MatchResults
        matches={[
          {
            index: 0,
            end: 3,
            match: "abc",
            groups: [
              { index: 1, name: "opt", text: null, parentIndex: null },
              { index: 2, text: "", start: null, end: null, parentIndex: null },
            ],
          },
        ]}
        executionTimeMs={0}
        truncated={false}
        status="idle"
      />,
    );

    const emptyLabels = screen.getAllByText("(empty)");
    expect(emptyLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders group without name (index only)", () => {
    render(
      <MatchResults
        matches={[
          {
            index: 0,
            end: 2,
            match: "ab",
            groups: [
              {
                index: 1,
                text: "ab",
                start: 0,
                end: 2,
                parentIndex: null,
              },
            ],
          },
        ]}
        executionTimeMs={0}
        truncated={false}
        status="idle"
      />,
    );

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getAllByText("[0, 2)").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("(outer)")).not.toBeInTheDocument();
  });
});

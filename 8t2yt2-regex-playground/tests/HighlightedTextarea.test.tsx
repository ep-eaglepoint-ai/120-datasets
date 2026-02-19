import React from "react";
import { render, screen } from "@testing-library/react";

import HighlightedTextarea from "../repository_after/src/components/HighlightedTextarea";

const renderHighlighted = (ranges: Array<{ start: number; end: number }>) => {
  return render(
    <HighlightedTextarea
      id="test-text"
      label="Test Text"
      value="ababa"
      onChange={() => undefined}
      ranges={ranges}
      highlightEnabled
    />,
  );
};

describe("HighlightedTextarea", () => {
  it("renders highlighted spans for overlapping matches", () => {
    renderHighlighted([
      { start: 0, end: 3 },
      { start: 2, end: 5 },
    ]);

    const highlighted = document.querySelectorAll(
      ".bg-theme_lightSkyBlue, .bg-theme_frenchSkyBlue, .bg-theme_rajah",
    );
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it("renders zero-length markers", () => {
    renderHighlighted([{ start: 2, end: 2 }]);

    const markers = document.querySelectorAll(".border-l-2");
    expect(markers.length).toBeGreaterThan(0);
  });

  it("supports multiline content rendering", () => {
    render(
      <HighlightedTextarea
        id="test-text"
        label="Test Text"
        value={"line1\nline2"}
        onChange={() => undefined}
        ranges={[{ start: 0, end: 5 }]}
        highlightEnabled
      />,
    );

    expect(screen.getByLabelText("Test Text")).toBeInTheDocument();
  });
});

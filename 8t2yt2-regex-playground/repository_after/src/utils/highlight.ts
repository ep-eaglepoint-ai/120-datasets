export interface HighlightRange {
  start: number;
  end: number;
}

export type HighlightToken =
  | { type: "text"; text: string; activeCount: number }
  | { type: "marker" };

export interface HighlightLayout {
  tokens: HighlightToken[];
}

export const buildHighlightLayout = (
  text: string,
  ranges: HighlightRange[],
): HighlightLayout => {
  if (!text || ranges.length === 0) {
    return { tokens: [{ type: "text", text, activeCount: 0 }] };
  }

  const events: Array<{ index: number; type: "start" | "end" }> = [];
  const markers = new Map();
  const maxIndex = text.length;

  ranges.forEach((range) => {
    const start = Math.max(0, Math.min(maxIndex, range.start));
    const end = Math.max(0, Math.min(maxIndex, range.end));
    if (start === end) {
      const count = markers.get(start) || 0;
      markers.set(start, count + 1);
      return;
    }
    events.push({ index: start, type: "start" });
    events.push({ index: end, type: "end" });
  });

  events.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    if (a.type === b.type) return 0;
    return a.type === "end" ? -1 : 1;
  });

  const tokens: HighlightToken[] = [];
  let activeCount = 0;
  let cursor = 0;
  let markerIndex = 0;
  const markerPositions = Array.from(markers.keys()).sort((a, b) => a - b);

  const pushMarkersUpTo = (index: number) => {
    while (
      markerIndex < markerPositions.length &&
      markerPositions[markerIndex] <= index
    ) {
      const position = markerPositions[markerIndex];
      if (cursor < position) {
        tokens.push({
          type: "text",
          text: text.slice(cursor, position),
          activeCount,
        });
        cursor = position;
      }
      const count = markers.get(position) || 0;
      for (let i = 0; i < count; i += 1) {
        tokens.push({ type: "marker" });
      }
      markerIndex += 1;
    }
  };

  let eventIndex = 0;
  while (eventIndex < events.length) {
    const currentIndex = events[eventIndex].index;
    pushMarkersUpTo(currentIndex);

    if (cursor < currentIndex) {
      tokens.push({
        type: "text",
        text: text.slice(cursor, currentIndex),
        activeCount,
      });
      cursor = currentIndex;
    }

    while (
      eventIndex < events.length &&
      events[eventIndex].index === currentIndex &&
      events[eventIndex].type === "end"
    ) {
      activeCount = Math.max(0, activeCount - 1);
      eventIndex += 1;
    }

    while (
      eventIndex < events.length &&
      events[eventIndex].index === currentIndex &&
      events[eventIndex].type === "start"
    ) {
      activeCount += 1;
      eventIndex += 1;
    }
  }

  pushMarkersUpTo(text.length);

  if (cursor < text.length) {
    tokens.push({ type: "text", text: text.slice(cursor), activeCount });
  }

  return { tokens };
};

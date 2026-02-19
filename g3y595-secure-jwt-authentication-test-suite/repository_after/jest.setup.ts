import "@testing-library/jest-dom";

// Avoid pulling ESM-only icon deps into Jest; we only need placeholders for rendering.
jest.mock("lucide-react", () => {
  const React = require("react");
  const icon = (name: string) => (props: any) =>
    React.createElement("svg", { "data-icon": name, ...props });
  return {
    AlertCircle: icon("AlertCircle"),
    CheckCircle: icon("CheckCircle"),
    Lock: icon("Lock"),
    LogOut: icon("LogOut"),
    Shield: icon("Shield"),
    Activity: icon("Activity"),
  };
});

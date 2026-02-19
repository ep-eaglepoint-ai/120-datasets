// import "@testing-library/jest-dom";
// import "whatwg-fetch";
// import { TextEncoder, TextDecoder } from "util";

// global.TextEncoder = TextEncoder as any;
// global.TextDecoder = TextDecoder as any;

// Object.defineProperty(window, "matchMedia", {
//   writable: true,
//   value: jest.fn().mockImplementation((query) => ({
//     matches: false,
//     media: query,
//     onchange: null,
//     addListener: jest.fn(),
//     removeListener: jest.fn(),
//     addEventListener: jest.fn(),
//     removeEventListener: jest.fn(),
//     dispatchEvent: jest.fn(),
//   })),
// });

import "@testing-library/jest-dom";
import "whatwg-fetch";
import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ✅ SUPPRESS REACT ROUTER v7 WARNINGS
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args[0];
  // Check if the warning is exactly the React Router one and ignore it
  if (
    typeof msg === "string" &&
    msg.includes("React Router Future Flag Warning")
  ) {
    return;
  }
  // Otherwise, print the warning as usual
  originalWarn(...args);
};

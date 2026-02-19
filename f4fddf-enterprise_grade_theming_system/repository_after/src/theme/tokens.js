export const THEME_MODES = {
  SYSTEM: "system",
  LIGHT: "light",
  DARK: "dark",
};

export const tokens = {
  light: {
    "--bg-primary": "#FFFFFF",
    "--bg-secondary": "#F5F5F5",
    "--bg-tertiary": "#E0E0E0",
    "--text-primary": "#000000",
    "--text-secondary": "#2D2D2D",
    "--text-muted": "#4D4D4D",
    "--interactive-default": "#0056B3",
    "--interactive-hover": "#004494",
    "--interactive-active": "#003366",
    "--color-success": "#006400", // AAA on white
    "--color-error": "#8B0000", // AAA on white
    "--color-warning": "#7B5E00", // AAA on white (dark yellow)
    "--color-info": "#004B87", // AAA on white
    "--border-color": "#CCCCCC",
    "--shadow-sm": "0 1px 2px rgba(0,0,0,0.1)",
    "--shadow-md": "0 4px 6px rgba(0,0,0,0.1)",
    "--shadow-lg": "0 10px 15px rgba(0,0,0,0.1)",
    "--focus-ring": "0 0 0 3px rgba(0, 86, 179, 0.5)",
    "--transition-speed": "300ms",
    "--transition-bezier": "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  dark: {
    "--bg-primary": "#121212",
    "--bg-secondary": "#1E1E1E",
    "--bg-tertiary": "#2C2C2C",
    "--text-primary": "#FFFFFF",
    "--text-secondary": "#E0E0E0",
    "--text-muted": "#BDBDBD",
    "--interactive-default": "#66B2FF",
    "--interactive-hover": "#99CCFF",
    "--interactive-active": "#CCE5FF",
    "--color-success": "#90EE90", // Contrast with dark bg
    "--color-error": "#FFB6C1", // Contrast with dark bg
    "--color-warning": "#FFD700", // Contrast with dark bg
    "--color-info": "#ADD8E6", // Contrast with dark bg
    "--border-color": "#444444",
    "--shadow-sm": "0 1px 2px rgba(0,0,0,0.5)",
    "--shadow-md": "0 4px 6px rgba(0,0,0,0.5)",
    "--shadow-lg": "0 10px 15px rgba(0,0,0,0.5)",
    "--focus-ring": "0 0 0 3px rgba(102, 178, 255, 0.5)",
    "--transition-speed": "300ms",
    "--transition-bezier": "cubic-bezier(0.4, 0, 0.2, 1)",
  },
};

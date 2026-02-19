import React, { FunctionComponent } from "react";

const FLAGS = [
  { flag: "g", label: "Global" },
  { flag: "i", label: "Insensitive" },
  { flag: "m", label: "Multiline" },
  { flag: "s", label: "Dotall" },
  { flag: "u", label: "Unicode" },
  { flag: "y", label: "Sticky" },
];

interface Props {
  flags: string;
  onToggle: (flag: string) => void;
}

const FlagToggles: FunctionComponent<Props> = ({ flags, onToggle }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {FLAGS.map(({ flag, label }) => {
        const enabled = flags.includes(flag);
        return (
          <button
            key={flag}
            type="button"
            onClick={() => onToggle(flag)}
            className={`px-3 py-2 rounded border-2 text-sm font-semibold transition ${
              enabled
                ? "border-theme_slateBlue text-theme_slateBlue bg-white"
                : "border-theme_lavenderBlue text-theme_textGray bg-white"
            }
            `}
          >
            <span className="font-mono mr-1">{flag}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default FlagToggles;

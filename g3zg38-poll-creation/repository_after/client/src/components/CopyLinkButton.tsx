import { useState } from 'react';

interface CopyLinkButtonProps {
  url: string;
  className?: string;
}

/** Req 2: copy-to-clipboard for shareable poll link */
export function CopyLinkButton({ url, className = '' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition ${className}`}
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}

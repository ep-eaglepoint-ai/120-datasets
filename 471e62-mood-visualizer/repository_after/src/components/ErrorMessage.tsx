interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;
  
  return (
    <div className="bg-red-50 border-2 border-red-300 text-red-700 px-6 py-4 rounded-xl mb-4 animate-slide-in shadow-md" role="alert">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{message}</span>
      </div>
    </div>
  );
}

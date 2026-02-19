export function createError(message: string, statusCode: number) {
  const error = new Error(message) as any;
  error.statusCode = statusCode;
  return error;
}


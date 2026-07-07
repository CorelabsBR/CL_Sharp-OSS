export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

export function reportError(error: unknown, updateStatus: (text: string) => void, context: string): string {
  const message = `${context}: ${errorMessage(error)}`;
  console.error(message, error);
  updateStatus(message);
  return message;
}

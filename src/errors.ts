export type GenerateErrorCode = "INVALID_INPUT" | "DIRECTORY_EXISTS" | "CANCELLED" | "SNAPSHOT_INVALID" | "GENERATION_FAILED";

export class GenerateError extends Error {
  constructor(public readonly code: GenerateErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GenerateError";
  }
}

export function generationError(error: unknown): GenerateError {
  if (error instanceof GenerateError) return error;
  if (error instanceof Error && error.name === "AbortError") return new GenerateError("CANCELLED", "Generation cancelled", {cause: error});
  return new GenerateError("GENERATION_FAILED", error instanceof Error ? error.message : String(error), {cause: error});
}

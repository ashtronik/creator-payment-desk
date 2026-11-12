export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const nearAccountIdPattern = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

function stringResult(value: unknown, name: string, maxLength: number): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `${name} must be a string` };
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${name} is too long` };
  }

  return { ok: true, value: trimmed };
}

export function validateNearAddress(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "near address must be a string" };
  }

  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 64 || !nearAccountIdPattern.test(trimmed)) {
    return { ok: false, error: "invalid near address" };
  }

  return { ok: true, value: trimmed };
}

export function validateAmountCents(value: unknown): ValidationResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 100 || value > 1_000_000) {
    return { ok: false, error: "amount must be an integer between 100 and 1000000 cents" };
  }

  return { ok: true, value };
}

export function validateDeliverableUrl(value: unknown): ValidationResult<string> {
  const result = stringResult(value, "deliverable url", 2_000);
  if (!result.ok) return result;

  try {
    const url = new URL(result.value);
    if (url.protocol !== "https:") {
      return { ok: false, error: "deliverable url must use https" };
    }
  } catch {
    return { ok: false, error: "deliverable url must be a valid https URL" };
  }

  return result;
}

export function validateDescription(value: unknown): ValidationResult<string> {
  return stringResult(value, "description", 500);
}

export function validateClientName(value: unknown): ValidationResult<string> {
  return stringResult(value, "client name", 100);
}


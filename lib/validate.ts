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

const deliverableUrlError = "Enter a link like example.com";

export function normalizeDeliverableUrl(value: unknown): ValidationResult<string> {
  if (value == null) return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: deliverableUrlError };

  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: "" };
  if (trimmed.length > 2_000 || /\s/.test(trimmed)) {
    return { ok: false, error: deliverableUrlError };
  }

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    if (/^[A-Za-z0-9+.-]+:(?!\d)/.test(normalized)) {
      return { ok: false, error: deliverableUrlError };
    }
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: deliverableUrlError };
    }
    if (!url.hostname.includes(".") || url.username || url.password) {
      return { ok: false, error: deliverableUrlError };
    }
  } catch {
    return { ok: false, error: deliverableUrlError };
  }

  return { ok: true, value: normalized };
}

export const validateDeliverableUrl = normalizeDeliverableUrl;

export function validateDescription(value: unknown): ValidationResult<string> {
  const result = stringResult(value, "description", 500);
  if (!result.ok) return result;
  if (result.value.length === 0) {
    return { ok: false, error: "description must not be empty" };
  }
  return result;
}

export function validateClientName(value: unknown): ValidationResult<string> {
  return stringResult(value, "client name", 100);
}


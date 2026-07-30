import "server-only";

import { NextResponse } from "next/server";

type ApiErrorResponseOptions = {
  code?: string;
  fallbackMessage: string;
  status: number;
};

type ApiErrorPayload = {
  code?: string;
  details?: string;
  error: string;
};

const emptyObjectMessage = "The provider returned an empty error response.";

export function createApiErrorResponse(error: unknown, options: ApiErrorResponseOptions) {
  const payload = createApiErrorPayload(error, options);

  return NextResponse.json(payload, { status: options.status });
}

export function createApiErrorPayload(error: unknown, options: Omit<ApiErrorResponseOptions, "status">): ApiErrorPayload {
  const message = getSafeErrorMessage(error, options.fallbackMessage);
  const details = getSafeErrorDetails(error);

  return {
    ...(options.code ? { code: options.code } : {}),
    ...(details && details !== message ? { details } : {}),
    error: message
  };
}

export function getSafeErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (isRecord(error)) {
    const knownMessage = getStringValue(error, ["message", "error", "reason", "description", "error_description"]);

    if (knownMessage) {
      return knownMessage;
    }

    const nestedError = error.error;

    if (nestedError && nestedError !== error) {
      const nestedMessage: string = getSafeErrorMessage(nestedError, "");

      if (nestedMessage) {
        return nestedMessage;
      }
    }

    if (Object.keys(error).length === 0) {
      return fallbackMessage;
    }
  }

  return fallbackMessage;
}

export async function getResponseErrorPayload(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    const message = getSafeErrorMessage(payload, fallbackMessage);
    const details = getSafeErrorDetails(payload);

    return {
      details,
      message
    };
  }

  const text = await response.text().catch(() => "");
  const trimmedText = text.trim();

  return {
    details: trimmedText || undefined,
    message: trimmedText || fallbackMessage
  };
}

function getSafeErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return error.cause ? getSafeErrorMessage(error.cause, "") : undefined;
  }

  if (typeof error === "string") {
    return error.trim() || undefined;
  }

  if (!isRecord(error)) {
    return undefined;
  }

  if (Object.keys(error).length === 0) {
    return emptyObjectMessage;
  }

  const knownDetails = getStringValue(error, ["details", "detail", "hint", "code"]);

  if (knownDetails) {
    return knownDetails;
  }

  return stringifySafeRecord(error);
}

function getStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function stringifySafeRecord(record: Record<string, unknown>) {
  try {
    return JSON.stringify(record, (_, value) => {
      if (typeof value === "string" && isSensitiveValue(value)) {
        return "[redacted]";
      }

      return value;
    });
  } catch {
    return undefined;
  }
}

function isSensitiveValue(value: string) {
  return /APP_USR-|Bearer\s+|re_[A-Za-z0-9_-]+/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

import { net } from "electron";
import { CHAT_PROVIDER_PRESETS } from "../../shared/constants";
import type { ChatProviderModel, Settings } from "../../shared/types";

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
};

type ChatModelsResponse = {
  data?: unknown;
  models?: unknown;
  error?: {
    message?: string;
  };
};

function chatCompletionsUrl(baseUrl: string): string {
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    throw new Error("baseUrl cannot be empty");
  }
  const url = new URL(baseUrl.trim());
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/v1/chat/completions";
    return url.toString();
  }
  if (!url.pathname.endsWith("/chat/completions")) {
    url.pathname = `${url.pathname}/chat/completions`.replace(/\/{2,}/g, "/");
  }
  return url.toString();
}

function chatModelsUrl(baseUrl: string): string {
  const url = new URL(baseUrl.trim() || CHAT_PROVIDER_PRESETS["openai-compatible"].baseUrl);
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/v1/models";
    return url.toString();
  }
  if (url.pathname.endsWith("/chat/completions")) {
    url.pathname = url.pathname.replace(/\/chat\/completions$/, "/models");
    return url.toString();
  }
  if (!url.pathname.endsWith("/models")) {
    url.pathname = `${url.pathname}/models`.replace(/\/{2,}/g, "/");
  }
  return url.toString();
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("")
    .trim();
}

function extractReply(body: ChatCompletionResponse): string {
  const reply = textFromContent(body.choices?.[0]?.message?.content);
  if (reply) return reply;
  if (body.error?.message) throw new Error(body.error.message);
  throw new Error("Chat provider returned an empty response.");
}

export async function sendChatCompletion(
  settings: Settings,
  messages: ChatCompletionMessage[]
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const apiKey = settings.chatApiKey.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await net.fetch(chatCompletionsUrl(settings.chatBaseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: settings.chatModel.trim(),
      user: "pawpal-desktop",
      messages
    })
  });

  const responseText = await response.text();
  let body: ChatCompletionResponse = {};
  if (responseText) {
    try {
      body = JSON.parse(responseText) as ChatCompletionResponse;
    } catch {
      if (!response.ok) {
        throw new Error(responseText.slice(0, 240));
      }
      throw new Error("Chat provider returned a response that was not JSON.");
    }
  }

  if (!response.ok) {
    throw new Error(body.error?.message ?? `Chat provider request failed with HTTP ${response.status}.`);
  }

  return extractReply(body);
}

function modelFromValue(value: unknown): ChatProviderModel | null {
  if (typeof value === "string" && value.trim()) {
    return { id: value.trim() };
  }
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string") {
    return null;
  }
  const ownedBy =
    "owned_by" in value && typeof value.owned_by === "string"
      ? value.owned_by
      : "ownedBy" in value && typeof value.ownedBy === "string"
        ? value.ownedBy
        : undefined;
  return {
    id: value.id,
    ownedBy
  };
}

function extractModels(body: ChatModelsResponse): ChatProviderModel[] {
  const source = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : [];
  const seen = new Set<string>();
  const models: ChatProviderModel[] = [];
  for (const entry of source) {
    const model = modelFromValue(entry);
    if (!model || seen.has(model.id)) continue;
    seen.add(model.id);
    models.push(model);
  }
  return models.sort((left, right) => left.id.localeCompare(right.id));
}

export async function listChatModels(settings: Settings): Promise<ChatProviderModel[]> {
  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  const apiKey = settings.chatApiKey.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await net.fetch(chatModelsUrl(settings.chatBaseUrl), {
    method: "GET",
    headers
  });

  const responseText = await response.text();
  let body: ChatModelsResponse = {};
  if (responseText) {
    try {
      body = JSON.parse(responseText) as ChatModelsResponse;
    } catch {
      if (!response.ok) {
        throw new Error(responseText.slice(0, 240));
      }
      throw new Error("Chat provider returned a models response that was not JSON.");
    }
  }

  if (!response.ok) {
    throw new Error(body.error?.message ?? `Chat provider models request failed with HTTP ${response.status}.`);
  }

  return extractModels(body);
}

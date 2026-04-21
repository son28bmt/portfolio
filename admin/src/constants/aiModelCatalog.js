export const AI_MODEL_CATALOG = {
  chatgpt: [
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "o1",
    "o3-mini",
  ],
  gemini: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  claude: [
    "claude-opus-4-1",
    "claude-opus-4",
    "claude-sonnet-4-5",
    "claude-3-7-sonnet",
    "claude-3-5-sonnet",
    "claude-3-5-haiku",
  ],
  grok: [
    "grok-4",
    "grok-3",
    "grok-3-mini",
    "grok-beta",
  ],
  deepseek: [
    "deepseek-chat",
    "deepseek-reasoner",
    "deepseek-v3",
    "deepseek-r1",
  ],
  image: [
    "gpt-image-1",
    "dall-e-3",
    "imagen-3",
    "flux-1-dev",
  ],
};

export const getModelsByProvider = (provider) =>
  AI_MODEL_CATALOG[String(provider || "").trim().toLowerCase()] || [];


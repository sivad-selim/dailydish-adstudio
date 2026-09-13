export type MessageLanguage = "fr" | "en" | "pt";
export type MessageTranslation = {
  title: string;
  description: string;
};
export type MessageTranslations = Record<
  MessageLanguage,
  MessageTranslation
>;
export const MESSAGE_LANGUAGES: Array<{
  id: MessageLanguage;
  shortLabel: string;
  label: string;
}> = [
  { id: "en", shortLabel: "EN", label: "English" },
  { id: "fr", shortLabel: "FR", label: "Français" },
  { id: "pt", shortLabel: "BR", label: "Português" },
];

export const EMPTY_TRANSLATIONS: MessageTranslations = {
  fr: { title: "", description: "" },
  en: { title: "", description: "" },
  pt: { title: "", description: "" },
};

export function readTranslations(value: unknown): MessageTranslations {
  const record = (value ?? {}) as Partial<MessageTranslations>;
  return Object.fromEntries(MESSAGE_LANGUAGES.map(({id}) => [id, {
    title: typeof record[id]?.title === "string" ? record[id]!.title : "",
    description: typeof record[id]?.description === "string" ? record[id]!.description : "",
  }])) as MessageTranslations;
}

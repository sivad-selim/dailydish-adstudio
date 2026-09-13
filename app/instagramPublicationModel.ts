import type { MessageLanguage, MessageTranslations } from "../firebase/messages";
import type { InstagramAccount } from "../firebase/instagram";

export const PUBLICATION_ACCOUNTS: Array<{id: InstagramAccount; language: MessageLanguage; username: string; label: string}> = [
  { id: "en", language: "en", username: "mydailydishapp", label: "EN" },
  { id: "fr", language: "fr", username: "mydailydishapp.fr", label: "FR" },
  { id: "br", language: "pt", username: "mydailydishapp.br", label: "BR" },
];
export function publicationTranslation(message: {translations: MessageTranslations} | undefined, language: MessageLanguage) {
  const title = message?.translations[language]?.title?.trim() ?? "";
  const description = message?.translations[language]?.description?.trim() ?? "";
  return { title, description, caption: [title, description].filter(Boolean).join("\n\n") };
}

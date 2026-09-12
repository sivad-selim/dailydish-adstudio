import type { Campaign, CampaignLanguage } from "../firebase/campaigns";
import type { InstagramAccount } from "../firebase/instagram";

export const PUBLICATION_ACCOUNTS: Array<{id: InstagramAccount; language: CampaignLanguage; username: string; label: string}> = [
  { id: "en", language: "en", username: "mydailydishapp", label: "EN" },
  { id: "fr", language: "fr", username: "mydailydishapp.fr", label: "FR" },
  { id: "br", language: "pt", username: "mydailydishapp.br", label: "BR" },
];
export function publicationTranslation(campaign: Campaign | undefined, language: CampaignLanguage) {
  const title = campaign?.translations[language]?.title?.trim() ?? "";
  const description = campaign?.translations[language]?.description?.trim() ?? "";
  return { title, description, caption: [title, description].filter(Boolean).join("\n\n") };
}

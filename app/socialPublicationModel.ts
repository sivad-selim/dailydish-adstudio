import {PUBLICATION_ACCOUNTS} from "./instagramPublicationModel";
import type {InstagramAccount} from "../firebase/instagram";

export type SocialPlatform = "instagram" | "facebook";
export type SocialTarget = `${SocialPlatform}_${InstagramAccount}`;
export const SOCIAL_PLATFORMS: SocialPlatform[] = ["instagram", "facebook"];
export const platformLabel = (platform: SocialPlatform) => platform === "facebook" ? "Facebook" : "Instagram";
const pageNames = {en: "DailyDish", fr: "DailyDish - fr", br: "DailyDish - br"};
const pageIds = {en: "1207160595823403", fr: "1289897627544141", br: "1268961959637083"};
export const SOCIAL_ACCOUNTS = SOCIAL_PLATFORMS.flatMap((platform) => PUBLICATION_ACCOUNTS.map((account) => ({
  ...account, id: `${platform}_${account.id}` as SocialTarget, account: account.id, platform,
  label: `${platformLabel(platform)} · ${account.label}`,
  username: platform === "facebook" ? pageNames[account.id] : `@${account.username}`,
  pageUrl: platform === "facebook" ? `https://www.facebook.com/${pageIds[account.id]}` : `https://www.instagram.com/${account.username}/`,
})));
export function socialAccount(target: SocialTarget) {
  const account = SOCIAL_ACCOUNTS.find(({id}) => id === target);
  if (!account) throw new Error("Destination inconnue.");
  return account;
}
export function pendingSocialTargets(selected: SocialTarget[], platforms: SocialPlatform[], jobs: Partial<Record<SocialTarget, {status: string}>>) {
  return selected.filter((target) => {
    const {platform} = socialAccount(target);
    return platforms.includes(platform) && jobs[target]?.status !== "published" && !(platform === "facebook" && jobs[target]?.status === "uncertain");
  });
}

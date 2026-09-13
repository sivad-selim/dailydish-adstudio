import * as instagram from "./instagramPublishing";
import * as facebook from "./facebookPublishing";
import {socialAccount, type SocialPlatform, type SocialTarget} from "../app/socialPublicationModel";

export type SocialPublication = Omit<instagram.InstagramPublication, "account"> & {account: SocialTarget};
export const socialImageUrl = instagram.instagramImageUrl;
export async function verifySocialTarget(target: SocialTarget) {
  const {platform, account} = socialAccount(target);
  if (platform === "facebook") await facebook.verifyFacebookConnection(account);
}
export async function uploadSocialImage(entryId: string, target: SocialTarget, jpeg: Blob) {
  const {platform, account} = socialAccount(target);
  return platform === "facebook" ? facebook.uploadFacebookImage(entryId, account, jpeg) : instagram.uploadInstagramImage(entryId, account, jpeg);
}
export async function publishSocialPost(input: Pick<SocialPublication, "entryId" | "postId" | "account" | "imagePath" | "imagePaths" | "caption">): Promise<SocialPublication> {
  const {platform, account} = socialAccount(input.account);
  const result = await (platform === "facebook" ? facebook.publishFacebookPost : instagram.publishInstagramPost)({...input, account});
  return {...result, account: input.account};
}
export async function resetSocialPublication(job: SocialPublication) {
  const {platform, account} = socialAccount(job.account);
  return (platform === "facebook" ? facebook.resetFacebookPublication : instagram.resetInstagramPublication)({...job, account});
}
export function subscribeSocialPublications(entryId: string, receive: (items: SocialPublication[]) => void, fail: () => void) {
  const values: Partial<Record<SocialPlatform, SocialPublication[]>> = {};
  const errors = new Set<SocialPlatform>();
  const update = (platform: SocialPlatform) => (items: instagram.InstagramPublication[]) => {
    values[platform] = items.map((item) => ({...item, account: `${platform}_${item.account}` as SocialTarget}));
    errors.delete(platform);
    if (values.instagram && values.facebook && !errors.size) receive([...values.instagram, ...values.facebook]);
  };
  const failure = (platform: SocialPlatform) => () => { errors.add(platform); fail(); };
  const stops = [instagram.subscribeInstagramPublications(entryId, update("instagram"), failure("instagram")), facebook.subscribeFacebookPublications(entryId, update("facebook"), failure("facebook"))];
  return () => stops.forEach((stop) => stop());
}

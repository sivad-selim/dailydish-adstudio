import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports, require(name) {if (!(name in imports)) throw new Error(name); return imports[name];}});
  return exports;
}
const original = load('../app/instagramPublicationModel.ts');
const model = load('../app/socialPublicationModel.ts', {'./instagramPublicationModel': original});

test('each network maps EN/FR/BR separately and BR uses Portuguese', () => {
  assert.equal(new Set(model.SOCIAL_ACCOUNTS.map(({id}) => id)).size, 6);
  assert.equal(model.socialAccount('facebook_br').language, 'pt');
  assert.equal(model.socialAccount('facebook_fr').pageUrl, 'https://www.facebook.com/1289897627544141');
  assert.equal(model.socialAccount('facebook_en').pageUrl, 'https://www.facebook.com/1207160595823403');
  assert.equal(model.socialAccount('facebook_br').pageUrl, 'https://www.facebook.com/1268961959637083');
});

test('both networks send only selected destinations and do not repeat successes or uncertain Facebook posts', () => {
  const targets = ['instagram_fr', 'facebook_fr', 'facebook_br', 'instagram_br'];
  const jobs = {instagram_fr: {status: 'published'}, facebook_br: {status: 'uncertain'}, instagram_br: {status: 'uncertain'}};
  assert.deepEqual(Array.from(model.pendingSocialTargets(targets, ['facebook'], jobs)), ['facebook_fr']);
  assert.deepEqual(Array.from(model.pendingSocialTargets(targets, ['instagram', 'facebook'], jobs)), ['facebook_fr', 'instagram_br']);
});

function client() {
  const calls = [];
  const subscriptions = {};
  const adapter = (platform) => {
    const upper = platform[0].toUpperCase() + platform.slice(1);
    return {
      [`${platform}ImageUrl`]: () => {},
      [`verify${upper}Connection`]: async (account) => calls.push({platform, account, kind: 'verify'}),
      [`publish${upper}Post`]: async (input) => {calls.push({platform, ...input}); return {...input, status: 'published'};},
      [`upload${upper}Image`]: async (entryId, account) => {calls.push({platform, entryId, account}); return `${platform}-path`;},
      [`reset${upper}Publication`]: async (input) => calls.push({platform, ...input}),
      [`subscribe${upper}Publications`]: (entry, receive, fail) => {subscriptions[platform] = {receive, fail}; return () => {delete subscriptions[platform];};},
    };
  };
  const api = load('../firebase/socialPublishing.ts', {'../app/socialPublicationModel': model, './instagramPublishing': adapter('instagram'), './facebookPublishing': adapter('facebook')});
  return {api, calls, subscriptions};
}

test('publishing and reset route only to the selected platform with the original country', async () => {
  const {api, calls} = client();
  const result = await api.publishSocialPost({account: 'facebook_fr', caption: 'Bonjour', entryId: 'entry', imagePath: 'facebook-path'});
  assert.equal(result.account, 'facebook_fr');
  assert.equal(calls[0].platform, 'facebook');
  assert.equal(calls[0].account, 'fr');
  await api.resetSocialPublication(result);
  assert.equal(calls[1].platform, 'facebook');
  await api.publishSocialPost({account: 'instagram_br', caption: 'Olá'});
  assert.equal(calls[2].platform, 'instagram');
  assert.equal(calls[2].account, 'br');
});

test('combined history waits for both networks, keeps same-country attempts separate and cannot mask a read failure', () => {
  const {api, subscriptions} = client();
  const results = []; let failures = 0;
  const stop = api.subscribeSocialPublications('entry', (items) => results.push(items), () => failures++);
  subscriptions.instagram.receive([{account: 'fr', status: 'published'}]);
  assert.equal(results.length, 0);
  subscriptions.facebook.fail();
  subscriptions.instagram.receive([{account: 'fr', status: 'published'}]);
  assert.equal(results.length, 0);
  assert.equal(failures, 1);
  subscriptions.facebook.receive([{account: 'fr', status: 'failed'}]);
  assert.deepEqual(Array.from(results[0], (item) => item.account), ['instagram_fr', 'facebook_fr']);
  stop();
  assert.equal(Object.keys(subscriptions).length, 0);
});

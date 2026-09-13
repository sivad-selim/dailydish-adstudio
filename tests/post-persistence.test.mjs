import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as sdk from 'firebase/firestore';
import {initializeApp, deleteApp} from 'firebase/app';

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
test('owned posts: atomic editing, independent copies, text conflicts and access rules', {skip: !enabled}, async () => {
  const projectId = 'demo-adstudio-owned-pages';
  const app = initializeApp({projectId, apiKey:'demo'}, 'owned-pages');
  const db = sdk.getFirestore(app, 'ad-studio');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  sdk.connectFirestoreEmulator(db, host, Number(port), {mockUserToken:{sub:'owner', email:'mydailydishapp@gmail.com', email_verified:true}});
  const cache = new Map();
  function compile(filename) {
    filename = path.resolve(filename);
    if(cache.has(filename)) return cache.get(filename);
    const exports={}; cache.set(filename,exports);
    const source=fs.readFileSync(filename,'utf8');
    vm.runInThisContext('(function(exports, require) {'+ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+'\n})')(exports, name=> {
      if(name==='firebase/firestore')return {...sdk,getFirestore:()=>db};
      if(name==='./firebaseAuth')return {firebaseApp:app,allowedEmail:'mydailydishapp@gmail.com',firebaseAuth:{currentUser:{email:'mydailydishapp@gmail.com'}}};
      if(name.startsWith('.'))return compile(path.resolve(path.dirname(filename),name+'.ts'));
      throw new Error(name);
    });return exports;
  }
  const api=compile('firebase/posts.ts'), pageApi=compile('firebase/postPages.ts'), folderApi=compile('firebase/postFolders.ts'), duplicateFolder=compile('firebase/duplicatePostFolder.ts');
  const read=async(collection,id)=>(await sdk.getDoc(sdk.doc(db,collection,id))).data();
  const owns=async(postId)=> (await read('posts',postId)).pageIds;
  try {
    const folder = await folderApi.createPostFolder('Test');
    const gallery = await api.createStudioPost(folder, 2);
    assert.equal(gallery.type, 'gallery');
    assert.equal((await owns(gallery.id)).length, 2);
    for (const id of gallery.pageIds) assert.equal((await read('post-pages', id)).postId, gallery.id);
    const post = await api.createStudioPost(folder);
    const first = post.pageIds[0];
    assert.equal((await read('post-pages',first)).postId,post.id);
    assert.equal('type' in await read('posts',post.id), false);
    const second = await api.addPostPage(post.id);
    const [third,fourth] = await Promise.all([api.addPostPage(post.id), api.addPostPage(post.id)]);
    assert.equal((await owns(post.id)).length,4);
    const original = await read('post-pages',first);
    // Viewing or leaving an unchanged editor must preserve the prepared-source timestamp.
    await pageApi.savePostPage(pageApi.readPostPage(first, original));
    assert.equal((await read('post-pages',first)).updatedAt.toMillis(), original.updatedAt.toMillis());
    const en={...original.translations,en:{title:'English title',description:'English description'}};
    const fr={...original.translations,fr:{title:'Titre français',description:'Description française'}};
    await Promise.all([pageApi.savePageMessage(first,original.translations,en), pageApi.savePageMessage(first,original.translations,fr)]);
    const translated=await read('post-pages',first);
    assert.equal(translated.translations.en.title,'English title');
    assert.equal(translated.translations.fr.title,'Titre français');
    await assert.rejects(pageApi.savePageMessage(first,original.translations,{...original.translations,en:{title:'Conflict',description:''}}),/ailleurs/);
    // A stale layout editor must never overwrite translations or ownership.
    await pageApi.savePostPage({...original,id:first,properties:{...original.properties,textRotation:7}});
    assert.deepEqual((await read('post-pages',first)).translations, translated.translations);
    const beforeSwapFirst=await read('post-pages',first), beforeSwapSecond=await read('post-pages',second);
    await api.swapPageMessages(post.id,first,second);
    assert.deepEqual((await read('post-pages',second)).translations,beforeSwapFirst.translations);
    assert.deepEqual((await read('post-pages',first)).properties,beforeSwapFirst.properties);
    assert.deepEqual((await read('post-pages',second)).properties,beforeSwapSecond.properties);
    await api.reorderPostPages(post.id,[second,first,third,fourth]);
    assert.deepEqual(await owns(post.id),[second,first,third,fourth]);
    await assert.rejects(api.reorderPostPages(post.id,[first,second]),/changé/);
    const copy=await api.addPostPage(post.id,second);
    assert.deepEqual(await owns(post.id),[second,copy,first,third,fourth]);
    const copyBefore=await read('post-pages',copy);
    await pageApi.savePageMessage(second,beforeSwapFirst.translations,{...beforeSwapFirst.translations,fr:{title:'Updated original',description:''}});
    assert.deepEqual((await read('post-pages',copy)).translations,copyBefore.translations);
    const copiedPost=await api.duplicateStudioPost(post.id);
    assert.ok((await owns(copiedPost)).every(id=>!(new Set([first,second,third,fourth,copy])).has(id)));
    await api.transferPostPage(post.id,first,copiedPost,folder,(await owns(copiedPost))[0]);
    assert.equal((await read('post-pages',first)).postId,copiedPost);
    assert.deepEqual((await read('post-pages',first)).translations,beforeSwapSecond.translations);
    await assert.rejects(api.removePostPage(post.id,first),/appartient/);
    await api.removePostPage(post.id,fourth);
    assert.equal(await read('post-pages',fourth),undefined);
    await assert.rejects(pageApi.savePostPage({...original,id:fourth}),/No document|not-found|permission-denied|supprimée/);
    await api.moveStudioPost(post.id,'');
    assert.equal((await read('posts',post.id)).folderId,'');
    await folderApi.saveFolderPostOrder(folder,[copiedPost]);
    await duplicateFolder.duplicatePostFolder({id:folder,name:'Test',postOrder:[copiedPost]},[{id:copiedPost,folderId:folder,pageIds:await owns(copiedPost),updatedAt:0,type:'gallery'}]);
    await assert.rejects(sdk.setDoc(sdk.doc(db,'post-pages','orphan'),{...original,postId:'missing'}),/permission/i);
    await assert.rejects(sdk.setDoc(sdk.doc(db,'posts','empty'),{pageIds:[],folderId:''}),/permission/i);
    await assert.rejects(sdk.setDoc(sdk.doc(db,'messages','forbidden'),{translations:{}}),/permission/i);
    const max = await api.createStudioPost('');
    for(let i=1;i<10;i++)await api.addPostPage(max.id);
    await assert.rejects(api.addPostPage(max.id),/10/);
    await api.deleteStudioPost(max.id); // exercises rule access limits for a full gallery
    for(const row of (await sdk.getDocs(sdk.collection(db,'posts'))).docs)await api.deleteStudioPost(row.id);
    assert.equal((await sdk.getDocs(sdk.collection(db,'post-pages'))).size,0);
    for(const row of (await sdk.getDocs(sdk.collection(db,'post-folders'))).docs)await folderApi.deletePostFolder(row.id);
  } finally {await sdk.terminate(db); await deleteApp(app);}
});

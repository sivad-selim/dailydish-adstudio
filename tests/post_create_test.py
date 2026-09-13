import base64
import copy
from email.parser import BytesParser
from email.policy import default
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import Request, urlopen

spec = importlib.util.spec_from_file_location('post_create', Path(__file__).parents[1] / 'scripts/post-create.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
DEFAULTS = m.defaults()


class Firestore:
    def __init__(self):
        self.docs = {}
        self.commits = []
        self.lose_response = False
        self.fail_commit = False
        self.folders = [{'id': 'folder', 'data': {'name': 'Collection'}}]

    def list(self, collection):
        assert collection == 'post-folders'
        return self.folders

    def request(self, suffix, body):
        if suffix == ':batchGet':
            return [{'found': {'name': name, 'fields': self.docs[name]}} if name in self.docs else {'missing': name}
                    for name in reversed(body['documents'])]
        assert suffix == ':commit'
        self.commits.append(body['writes'])
        if self.fail_commit:
            raise ValueError('Offline')
        staged = copy.deepcopy(self.docs)
        for write in body['writes']:
            assert write['currentDocument'] == {'exists': False}
            name = write['update']['name']
            assert name not in staged
            staged[name] = copy.deepcopy(write['update']['fields'])
            for transform in write['updateTransforms']:
                assert transform['setToServerValue'] == 'REQUEST_TIME'
                staged[name][transform['fieldPath']] = {'timestampValue': '2026-09-13T00:00:00Z'}
        self.docs = staged
        if self.lose_response:
            raise OSError('Response lost after commit')
        return {}


class Storage(m.Storage):
    def __init__(self):
        super().__init__('not-a-token')
        self.objects = {}
        self.uploads = 0
        self.lose_response = False

    def request(self, url, data=None, content_type='application/json', missing_ok=False):
        if data is None:
            name = unquote(url.split('/o/')[1])
            return self.objects.get(name)
        query = parse_qs(urlparse(url).query)
        assert query['ifGenerationMatch'] == ['0']
        assert query['uploadType'] == ['multipart']
        name = query['name'][0]
        assert name not in self.objects
        message = BytesParser(policy=default).parsebytes(
            ('MIME-Version: 1.0\r\nContent-Type: ' + content_type + '\r\n\r\n').encode() + data)
        metadata, image = list(message.iter_parts())
        result = json.loads(metadata.get_payload(decode=True))
        blob = image.get_payload(decode=True)
        assert blob == PNG
        assert result['name'] == name
        assert result['md5Hash'] == base64.b64encode(m.hashlib.md5(blob).digest()).decode()
        result['size'] = str(len(blob))
        self.objects[name] = result
        self.uploads += 1
        if self.lose_response:
            self.lose_response = False
            raise OSError('Upload response lost')
        return result


class PostCreateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.original_audit = m.AUDIT
        m.AUDIT = self.root / 'audit'
        self.addCleanup(setattr, m, 'AUDIT', self.original_audit)
        self.image = self.root / 'Fond été.png'
        self.image.write_bytes(PNG)
        self.client, self.storage = Firestore(), Storage()

    def manifest(self, mode='gallery', count=3):
        return {'mode': mode, 'folder': 'Collection', 'pages': [
            {'image': self.image.name, 'translations': {lang: {'title': f'Page {i} {lang}', 'description': ''}
                                                     for lang in ('en', 'fr', 'br')}} for i in range(count)]}

    def plan(self, mode='gallery', count=3):
        return m.prepare(self.manifest(mode, count), self.root, self.client.folders, DEFAULTS)

    def test_three_images_create_three_posts_or_one_gallery_in_supplied_order(self):
        for mode, count in [('posts', 3), ('gallery', 1)]:
            docs, assets = m.records(self.plan(mode))
            posts = [fields for path, fields in docs.items() if path.startswith('posts/')]
            self.assertEqual(len(posts), count)
            ids = [id for post in posts for id in post['pageIds']]
            self.assertEqual(len(set(ids)), 3)
            for i, id in enumerate(ids):
                page = docs['post-pages/' + id]
                self.assertEqual(page['backgroundAssetId'], assets[i]['assetId'])
                self.assertEqual(page['properties']['images'], [])
                self.assertEqual(page['translations']['pt']['title'], f'Page {i} br')
                self.assertEqual(page['theme'], DEFAULTS['theme'])
                self.assertEqual(page['format'], DEFAULTS['format'])
            self.assertTrue(all(path.split('/')[0] in ('posts', 'post-pages') for path in docs))

    def test_source_and_all_translations_required_but_photo_only_is_valid(self):
        manifest = self.manifest(count=1)
        manifest['pages'][0]['translations'].pop('br')
        with self.assertRaisesRegex(ValueError, 'traductions'):
            m.prepare(manifest, self.root, self.client.folders, DEFAULTS)
        manifest['pages'][0].pop('translations')
        plan = m.prepare(manifest, self.root, self.client.folders, DEFAULTS)
        self.assertTrue(all(not text for fields in plan['pages'][0]['translations'].values() for text in fields.values()))

    def test_gallery_limit_format_aliases_and_ambiguous_folder(self):
        with self.assertRaises(ValueError):
            self.plan(count=11)
        with self.assertRaises(ValueError):
            m.prepare(self.manifest(), self.root, self.client.folders * 2, DEFAULTS)
        manifest = self.manifest()
        manifest.update(format='9:16', folder='')
        plan = m.prepare(manifest, self.root, [], DEFAULTS)
        self.assertEqual(plan['format'], 'story')
        self.assertEqual(plan['folderId'], '')

    def test_wrong_image_type_and_oversized_file_rejected(self):
        self.image.write_text('<svg/>')
        with self.assertRaises(ValueError):
            self.plan()
        with self.image.open('wb') as out:
            out.truncate(m.MAX_BYTES + 1)
        with self.assertRaises(ValueError):
            self.plan()

    def test_dry_run_does_not_upload_or_create(self):
        result = m.apply(self.plan(), self.client, self.storage)
        self.assertEqual(result['mode'], 'dry-run')
        self.assertEqual(self.storage.uploads, 0)
        self.assertEqual(self.client.commits, [])

    def test_changed_plan_or_file_rejected_before_any_upload(self):
        plan = self.plan()
        changed = copy.deepcopy(plan)
        changed['mode'] = 'posts'
        with self.assertRaises(ValueError):
            m.apply(changed, self.client, self.storage, True)
        self.image.write_bytes(PNG + b'changed')
        with self.assertRaises(ValueError):
            m.apply(plan, self.client, self.storage, True)
        self.assertEqual(self.storage.uploads, 0)

    def test_import_is_atomic_verified_and_repeating_it_does_not_duplicate(self):
        plan = self.plan()
        result = m.apply(plan, self.client, self.storage, True)
        self.assertEqual(result['mode'], 'created')
        self.assertEqual(len(self.client.commits), 1)
        self.assertEqual(len(self.client.docs), 4)
        self.assertEqual(self.storage.uploads, 3)
        self.assertEqual(m.apply(plan, self.client, self.storage, True)['mode'], 'already-created')
        self.assertEqual(len(self.client.commits), 1)
        self.assertEqual(self.storage.uploads, 3)
        audit = json.loads((m.AUDIT / (plan['id'] + '.json')).read_text())
        self.assertEqual(audit['status'], 'verified')
        self.assertNotIn('firebaseStorageDownloadTokens', json.dumps(audit))

    def test_lost_commit_response_is_resolved_by_readback(self):
        self.client.lose_response = True
        self.assertEqual(m.apply(self.plan(), self.client, self.storage, True)['mode'], 'created')

    def test_failed_commit_can_resume_without_reuploading_images(self):
        plan = self.plan()
        self.client.fail_commit = True
        with self.assertRaisesRegex(ValueError, 'même plan'):
            m.apply(plan, self.client, self.storage, True)
        self.assertEqual(self.client.docs, {})
        self.client.fail_commit = False
        self.assertEqual(m.apply(plan, self.client, self.storage, True)['mode'], 'created')
        self.assertEqual(self.storage.uploads, 3)

    def test_lost_upload_response_can_resume_without_overwriting_the_image(self):
        plan = self.plan()
        self.storage.lose_response = True
        with self.assertRaises(OSError):
            m.apply(plan, self.client, self.storage, True)
        self.assertEqual(self.client.commits, [])
        self.assertEqual(m.apply(plan, self.client, self.storage, True)['mode'], 'created')
        self.assertEqual(self.storage.uploads, 3)

    def test_existing_document_or_image_collision_never_overwrites(self):
        plan = self.plan()
        docs, assets = m.records(plan)
        name = m.api.ROOT + '/' + next(iter(docs))
        self.client.docs[name] = {'folderId': {'stringValue': 'different'}}
        with self.assertRaisesRegex(ValueError, 'écrasement'):
            m.apply(plan, self.client, self.storage, True)
        self.assertEqual(self.client.commits, [])
        self.client.docs.clear()
        self.storage.objects[assets[0]['assetId']] = {'size': '1'}
        with self.assertRaisesRegex(ValueError, 'remplacement'):
            m.apply(plan, self.client, self.storage, True)
        self.assertEqual(self.storage.uploads, 0)

    @unittest.skipUnless(os.environ.get('FIRESTORE_EMULATOR_HOST'), 'Firestore emulator not running')
    def test_real_firestore_commit_and_readback(self):
        host = os.environ['FIRESTORE_EMULATOR_HOST']
        self.assertRegex(host, r'^127\.0\.0\.1:[0-9]+$')
        previous_root = m.api.ROOT
        m.api.ROOT = 'projects/demo-adstudio-post-import/databases/ad-studio/documents'
        self.addCleanup(setattr, m.api, 'ROOT', previous_root)

        class Emulator:
            def request(self, suffix, body):
                request = Request('http://' + host + '/v1/' + m.api.ROOT + suffix,
                                  data=json.dumps(body).encode(),
                                  headers={'Content-Type': 'application/json', 'Authorization': 'Bearer owner'})
                with urlopen(request, timeout=30) as response:
                    return json.load(response)

            def list(self, collection):
                return []

        for mode, count in [('gallery', 1), ('posts', 3)]:
            manifest = self.manifest(mode)
            manifest['folder'] = ''
            plan = m.prepare(manifest, self.root, [], DEFAULTS)
            result = m.apply(plan, Emulator(), Storage(), True)
            self.assertEqual(result['mode'], 'created')
            self.assertEqual(len(result['postIds']), count)
            self.assertEqual(m.apply(plan, Emulator(), Storage(), True)['mode'], 'already-created')


if __name__ == '__main__':
    unittest.main()

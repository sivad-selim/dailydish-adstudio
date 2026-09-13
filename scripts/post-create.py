#!/usr/bin/env python3
"""Create draft posts from local background images and translated text. Dry-run by default."""
import argparse
import base64
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request
from urllib.parse import quote, urlencode
from uuid import UUID, uuid4, uuid5

spec = importlib.util.spec_from_file_location('post_translations', Path(__file__).with_name('post-translations.py'))
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
BUCKET = 'daily-dish-b10b4-ad-studio'
OWNER = 'mydailydishapp@gmail.com'
MAX_BYTES = 15 * 1024 * 1024
SCHEMA = 'background-post-import-v1'
AUDIT = Path(__file__).resolve().parents[1] / 'work/post-import-audit'


def defaults():
    result = subprocess.run(['node', str(Path(__file__).with_name('page-defaults.mjs')), '--post'],
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def inspect_image(path):
    path = Path(path).expanduser().resolve(strict=True)
    if not path.is_file() or not 0 < path.stat().st_size <= MAX_BYTES:
        raise ValueError('Chaque image doit être un fichier de 15 Mo maximum.')
    data = path.read_bytes()
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        mime, extension = 'image/png', 'png'
    elif data.startswith(b'\xff\xd8\xff'):
        mime, extension = 'image/jpeg', 'jpg'
    elif data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        mime, extension = 'image/webp', 'webp'
    else:
        raise ValueError(f'Image PNG, JPEG ou WebP requise : {path.name}')
    return {'path': str(path), 'size': len(data), 'mime': mime, 'extension': extension,
            'sha256': hashlib.sha256(data).hexdigest(),
            'md5': base64.b64encode(hashlib.md5(data).digest()).decode()}


def translations(value, source):
    if not isinstance(value, dict) or set(value) - {'en', 'fr', 'pt', 'br'}:
        raise ValueError('Traductions attendues : en, fr et br (ou pt).')
    if 'br' in value and 'pt' in value:
        raise ValueError('Utiliser br ou pt, pas les deux.')
    value = {('pt' if key == 'br' else key): fields for key, fields in value.items()}
    result = {}
    for language in ('en', 'fr', 'pt'):
        fields = value.get(language, {})
        if not isinstance(fields, dict) or set(fields) - {'title', 'description'}:
            raise ValueError('Seuls title et description sont acceptés.')
        result[language] = {field: fields.get(field, '') for field in ('title', 'description')}
        if any(not isinstance(text, str) for text in result[language].values()):
            raise ValueError('Les textes doivent être des chaînes.')
    for field in ('title', 'description'):
        filled = [language for language in result if result[language][field].strip()]
        if filled and (source not in filled or len(filled) != 3):
            raise ValueError(f'{field} : fournir la source et les traductions EN, FR et BR avant de créer le post.')
    return result


def prepare(manifest, base_dir, folders, page_defaults):
    if set(manifest) - {'mode', 'folder', 'format', 'source', 'pages'}:
        raise ValueError('Option inconnue dans la demande de création.')
    mode = manifest.get('mode')
    pages = manifest.get('pages', [])
    if mode not in ('posts', 'gallery') or not isinstance(pages, list) or not 1 <= len(pages) <= (10 if mode == 'gallery' else 100):
        raise ValueError('Choisir posts (1 à 100 images) ou gallery (1 à 10 pages).')
    source = manifest.get('source', 'fr').lower()
    source = 'pt' if source == 'br' else source
    if source not in ('en', 'fr', 'pt'):
        raise ValueError('Langue source invalide.')
    format_value = manifest.get('format', 'portrait')
    format_value = {'4:5': 'portrait', '9:16': 'story'}.get(format_value, format_value)
    if format_value not in ('portrait', 'story'):
        raise ValueError('Formats acceptés : portrait (4:5), story (9:16).')
    folder = api.resolve(folders, manifest['folder'], lambda row: row['data'].get('name', '')) if manifest.get('folder') else None
    result = {'schema': SCHEMA, 'project': api.PROJECT, 'database': api.DATABASE, 'bucket': BUCKET,
              'id': str(uuid4()), 'mode': mode, 'format': format_value, 'source': source,
              'folderId': folder['id'] if folder else '', 'defaults': page_defaults, 'pages': []}
    for item in pages:
        if not isinstance(item, dict) or set(item) - {'image', 'translations'} or not isinstance(item.get('image'), str):
            raise ValueError('Chaque page attend image et translations uniquement.')
        image = inspect_image(Path(base_dir) / item['image'])
        result['pages'].append({'image': image, 'translations': translations(item.get('translations', {}), source)})
    result['fingerprint'] = digest(result)
    return result


def validate_plan(plan):
    if (plan.get('schema'), plan.get('project'), plan.get('database'), plan.get('bucket')) != (SCHEMA, api.PROJECT, api.DATABASE, BUCKET):
        raise ValueError('Plan incompatible avec Ad Studio.')
    if plan.get('fingerprint') != digest({k: v for k, v in plan.items() if k != 'fingerprint'}):
        raise ValueError('Plan modifié après préparation. Refaire prepare avant tout nouvel import.')
    UUID(plan['id'])
    if plan['folderId'] and not re.fullmatch(r'[A-Za-z0-9_-]+', plan['folderId']):
        raise ValueError('Identifiant de dossier invalide.')
    if plan['mode'] not in ('posts', 'gallery') or not 1 <= len(plan['pages']) <= (10 if plan['mode'] == 'gallery' else 100):
        raise ValueError('Nombre de pages invalide.')
    if plan['format'] not in ('portrait', 'story') or plan['source'] not in ('en', 'fr', 'pt'):
        raise ValueError('Format ou langue invalide.')
    for page in plan['pages']:
        translations(page['translations'], plan['source'])


def records(plan):
    namespace = UUID(plan['id'])
    uid = lambda label: uuid5(namespace, label).hex
    docs, assets = {}, []
    groups = [plan['pages']] if plan['mode'] == 'gallery' else [[page] for page in plan['pages']]
    offset = 0
    for index, group in enumerate(groups):
        post_id = uid(f'post/{index}')
        page_ids = [uid(f'page/{offset + i}') for i in range(len(group))]
        docs['posts/' + post_id] = {'folderId': plan['folderId'], 'pageIds': page_ids, 'ownerEmail': OWNER}
        for item, page_id in zip(group, page_ids):
            asset = f"gallery/{plan['id']}-{offset}.{item['image']['extension']}"
            data = copy.deepcopy(plan['defaults'])
            data.update(postId=post_id, translations=item['translations'], format=plan['format'],
                        backgroundAssetId=asset, ownerEmail=OWNER,
                        name=item['translations'][plan['source']]['title'].strip() or Path(item['image']['path']).stem)
            data['properties']['images'] = []
            docs['post-pages/' + page_id] = data
            assets.append({**item['image'], 'assetId': asset})
            offset += 1
    return docs, assets


def existing_state(client, expected):
    names = {api.ROOT + '/' + path: fields for path, fields in expected.items()}
    responses = client.request(':batchGet', {'documents': list(names)})
    found, seen = 0, set()
    for response in responses:
        row = response.get('found')
        name = row['name'] if row else response.get('missing')
        if name not in names or name in seen:
            raise ValueError('Réponse de vérification Firestore inattendue.')
        seen.add(name)
        if row:
            fields = {k: v for k, v in row['fields'].items() if k not in ('createdAt', 'updatedAt')}
            if fields != {k: api.pack(v) for k, v in names[name].items()}:
                raise ValueError('Un document existe déjà avec des données différentes. Aucun écrasement effectué.')
            found += 1
    if seen != names.keys() or found not in (0, len(names)):
        raise ValueError('Import partiel ou réponse incomplète. Aucun nouvel enregistrement effectué.')
    return 'created' if found else 'missing'


class Storage:
    def __init__(self, token):
        self.token = token

    def request(self, url, data=None, content_type='application/json', missing_ok=False):
        request = urllib.request.Request(url, data=data, headers={
            'Authorization': 'Bearer ' + self.token, 'Content-Type': content_type})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404 and missing_ok:
                return None
            raise ValueError(f'Storage HTTP {error.code}. Relancer le même plan après résolution du problème.') from None

    def ensure(self, image, import_id):
        url = f"https://storage.googleapis.com/storage/v1/b/{BUCKET}/o/{quote(image['assetId'], safe='')}"
        current = self.request(url, missing_ok=True)
        if current is None:
            data = Path(image['path']).read_bytes()
            if hashlib.sha256(data).hexdigest() != image['sha256']:
                raise ValueError('Une image a changé pendant l’import.')
            boundary = 'adstudio-' + uuid4().hex
            metadata = {'name': image['assetId'], 'contentType': image['mime'], 'md5Hash': image['md5'],
                        'cacheControl': 'public,max-age=31536000,immutable',
                        'metadata': {'originalName': Path(image['path']).name, 'folderId': '',
                                     'adStudioImportId': import_id, 'sha256': image['sha256'],
                                     'firebaseStorageDownloadTokens': str(uuid4())}}
            body = (f'--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'.encode()
                    + json.dumps(metadata).encode() + f'\r\n--{boundary}\r\nContent-Type: {image["mime"]}\r\n\r\n'.encode()
                    + data + f'\r\n--{boundary}--\r\n'.encode())
            upload = f'https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?' + urlencode({
                'uploadType': 'multipart', 'name': image['assetId'], 'ifGenerationMatch': 0})
            self.request(upload, body, 'multipart/related; boundary=' + boundary)
            current = self.request(url)
        custom = current.get('metadata', {})
        if (current.get('name'), int(current.get('size', -1)), current.get('contentType'), current.get('md5Hash'),
                custom.get('adStudioImportId'), custom.get('sha256')) != (
                image['assetId'], image['size'], image['mime'], image['md5'], import_id, image['sha256']):
            raise ValueError('Image distante différente : aucun remplacement effectué.')
        if not custom.get('firebaseStorageDownloadTokens'):
            raise ValueError('URL Firebase de l’image indisponible.')


def apply(plan, client, storage, write=False, progress=lambda message: None):
    validate_plan(plan)
    expected, assets = records(plan)
    if plan['folderId'] and not any(row['id'] == plan['folderId'] for row in client.list('post-folders')):
        raise ValueError('Le dossier de destination n’existe plus.')
    state = existing_state(client, expected)
    result = {'mode': 'already-created' if state == 'created' else 'dry-run',
              'postIds': [path.split('/')[1] for path in expected if path.startswith('posts/')],
              'pageCount': len(assets), 'folderId': plan['folderId']}
    if state == 'created':
        return result
    # Validate ALL files before uploading the first one.
    for image in assets:
        actual = inspect_image(image['path'])
        if any(actual[key] != image[key] for key in actual):
            raise ValueError('Une image a changé depuis prepare. Aucun nouvel import effectué.')
    if not write:
        return result
    audit_path = AUDIT / (plan['id'] + '.json')
    if audit_path.exists() and json.loads(audit_path.read_text())['fingerprint'] != plan['fingerprint']:
        raise ValueError('Cet identifiant d’import a déjà été utilisé pour un autre plan.')
    api.save_private(audit_path, {'fingerprint': plan['fingerprint'], 'plan': plan, 'status': 'uploading'})
    for index, image in enumerate(assets, 1):
        progress(f'Image de fond {index}/{len(assets)} : import et vérification')
        storage.ensure(image, plan['id'])
    writes = [{'update': {'name': api.ROOT + '/' + path, 'fields': {key: api.pack(value) for key, value in fields.items()}},
               'currentDocument': {'exists': False},
               'updateTransforms': [{'fieldPath': key, 'setToServerValue': 'REQUEST_TIME'} for key in ('createdAt', 'updatedAt')]}
              for path, fields in expected.items()]
    if plan['folderId'] and not any(row['id'] == plan['folderId'] for row in client.list('post-folders')):
        raise ValueError('Le dossier a été supprimé pendant l’import des images. Aucun post créé.')
    progress('Création atomique des posts, des pages et des traductions')
    try:
        client.request(':commit', {'writes': writes})
    except (ValueError, OSError):
        # The server may have committed even when its response was lost.
        if existing_state(client, expected) != 'created':
            raise ValueError('Création non confirmée. Les images importées sont conservées ; relancer apply avec le même plan.') from None
    if existing_state(client, expected) != 'created':
        raise ValueError('Création non confirmée : relancer le même plan, sans en préparer un nouveau.')
    result['mode'] = 'created'
    api.save_private(audit_path, {'fingerprint': plan['fingerprint'], 'plan': plan, 'status': 'verified', 'result': result})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    prep = commands.add_parser('prepare', help='Valider les images et textes, préparer un plan sans écrire dans le cloud.')
    prep.add_argument('--file', required=True)
    prep.add_argument('--out', required=True)
    run = commands.add_parser('apply', help='Vérifier le plan ; --write importe les images et crée les brouillons.')
    run.add_argument('--file', required=True)
    run.add_argument('--write', action='store_true')
    args = parser.parse_args()
    path = Path(args.file).resolve()
    content = json.loads(path.read_text())
    if args.command == 'prepare':
        if Path(args.out).exists():
            raise ValueError('Le fichier de sortie existe déjà. Réutiliser ce plan pour reprendre un import.')
        folders = api.Firestore().list('post-folders') if content.get('folder') else []
        plan = prepare(content, path.parent, folders, defaults())
        api.save_private(args.out, plan)
        print(json.dumps({'mode': 'prepared', 'importId': plan['id'], 'file': str(Path(args.out).resolve()),
                          'posts': 1 if plan['mode'] == 'gallery' else len(plan['pages']), 'pages': len(plan['pages'])}))
    else:
        client = api.Firestore()
        print(json.dumps(apply(content, client, Storage(client.token), args.write,
                               lambda text: print(text, file=sys.stderr, flush=True)), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print(f'Import arrêté : {error}', file=sys.stderr)
        sys.exit(1)

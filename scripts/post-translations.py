#!/usr/bin/env python3
"""Local, authenticated Firestore translation workflow. No AI/API key required."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

PROJECT = 'daily-dish-b10b4'
DATABASE = 'ad-studio'
ROOT = f'projects/{PROJECT}/databases/{DATABASE}/documents'
LANGUAGES = ('fr', 'en', 'pt')
FIELDS = ('title', 'description')


def unpack(value):
    for kind in ('stringValue', 'timestampValue', 'booleanValue', 'integerValue', 'doubleValue'):
        if kind in value:
            return value[kind]
    if 'mapValue' in value:
        return {k: unpack(v) for k, v in value['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in value:
        return [unpack(v) for v in value['arrayValue'].get('values', [])]
    return None


def document(raw):
    return {'id': raw['name'].rsplit('/', 1)[-1], 'updateTime': raw.get('updateTime'),
            'data': {k: unpack(v) for k, v in raw.get('fields', {}).items()}}


class Firestore:
    def __init__(self):
        # Capture credentials in memory only; never print or include them in files.
        result = subprocess.run(['gcloud', 'auth', 'print-access-token'], capture_output=True, text=True)
        if result.returncode or not result.stdout.strip():
            raise ValueError('Connexion Google indisponible. Exécuter gcloud auth login avec le compte autorisé au projet, puis réessayer.')
        self.token = result.stdout.strip()

    def request(self, suffix, body=None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request('https://firestore.googleapis.com/v1/' + ROOT + suffix,
                                     data=data, headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Don't dump HTTP requests, credentials, or arbitrary server response bodies.
            raise ValueError(f'Firestore HTTP {error.code}. 403 : vérifier les droits IAM. 409/412 : données modifiées, refaire la préparation.') from None

    def list(self, collection):
        from urllib.parse import urlencode
        rows, cursor = [], ''
        while True:
            result = self.request('/' + collection + '?' + urlencode({'pageSize': 300, 'pageToken': cursor}))
            rows.extend(document(row) for row in result.get('documents', []))
            cursor = result.get('nextPageToken', '')
            if not cursor:
                return rows

    def get(self, page_id):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', page_id):
            raise ValueError('Identifiant de page invalide.')
        return document(self.request('/post-pages/' + page_id))


def resolve(rows, selector, label):
    matches = [row for row in rows if row['id'] == selector]
    if not matches:
        matches = [row for row in rows if label(row).strip().casefold() == selector.strip().casefold()]
    if len(matches) != 1:
        raise ValueError(f'Sélection introuvable ou ambiguë : {selector!r}. Utiliser un ID de la commande list.')
    return matches[0]


def title(row):
    translations = row['data'].get('translations', {})
    return next((translations.get(lang, {}).get('title', '') for lang in LANGUAGES
                 if translations.get(lang, {}).get('title', '').strip()), 'Message sans titre')


def language_list(value):
    if value.lower() == 'all':
        return list(LANGUAGES)
    result = list(dict.fromkeys('pt' if x.strip().lower() in ('br', 'pt-br') else x.strip().lower() for x in value.split(',')))
    if not result or any(lang not in LANGUAGES for lang in result):
        raise ValueError('Langues acceptées : fr,en,br (ou pt), all.')
    return result


def select_pages(pages, posts, folders, post_folder=None, selectors=None, post_selectors=None):
    selected_posts = posts
    if post_folder:
        folder = resolve(folders, post_folder, lambda row: row['data'].get('name', ''))
        selected_posts = [row for row in selected_posts if row['data'].get('folderId') == folder['id']]
    by_id = {row['id']: row for row in pages}
    def post_title(post):
        ids = post['data'].get('pageIds', [])
        return title(by_id[ids[0]]) if ids and ids[0] in by_id else 'Post sans titre'
    if post_selectors:
        ids = {resolve(posts, selector, post_title)['id'] for selector in post_selectors}
        selected_posts = [row for row in selected_posts if row['id'] in ids]
        if ids - {row['id'] for row in selected_posts}:
            raise ValueError('Un post sélectionné est en dehors du dossier demandé.')
    ids = [pid for post in selected_posts for pid in post['data'].get('pageIds', [])]
    if set(ids) - by_id.keys(): raise ValueError('Des pages du post sont introuvables.')
    selected = [by_id[pid] for pid in ids]
    if selectors:
        wanted = {resolve(pages, selector, title)['id'] for selector in selectors}
        selected = [row for row in selected if row['id'] in wanted]
        if wanted - {row['id'] for row in selected}:
            raise ValueError('Une page sélectionnée est en dehors des posts demandés.')
    return selected


def prepare(rows, languages, source):
    tasks = []
    for row in rows:
        translations = row['data'].get('translations', {})
        source_text = translations.get(source, {})
        missing = {lang: [field for field in FIELDS if source_text.get(field, '').strip()
                          and not translations.get(lang, {}).get(field, '').strip()]
                   for lang in languages if lang != source}
        tasks.append({'id': row['id'], 'title': title(row), 'updateTime': row['updateTime'],
                      'translations': translations, 'missing': {k: v for k, v in missing.items() if v},
                      'proposed': {}, 'sourceEmpty': not any(source_text.get(f, '').strip() for f in FIELDS)})
    return {'model': 'post-pages', 'project': PROJECT, 'database': DATABASE, 'source': source,
            'languages': languages, 'pages': tasks}


def build_writes(plan, current, overwrite=False):
    if plan.get('model') != 'post-pages' or plan.get('project') != PROJECT or plan.get('database') != DATABASE:
        raise ValueError('Plan incompatible avec cette base.')
    languages = plan.get('languages', [])
    if not languages or any(lang not in LANGUAGES for lang in languages):
        raise ValueError('Langues du plan invalides.')
    if plan.get('source') not in LANGUAGES:
        raise ValueError('Langue source invalide.')
    writes, seen = [], set()
    for task in plan['pages']:
        cid = task['id']
        if cid in seen or not re.fullmatch(r'[A-Za-z0-9_-]+', cid):
            raise ValueError('Identifiant dupliqué ou invalide.')
        seen.add(cid)
        proposed = task.get('proposed', {})
        if not proposed:
            continue
        row = current[cid]
        if not task.get('updateTime') or row['updateTime'] != task['updateTime']:
            raise ValueError(f'Page {cid} modifiée depuis sa lecture. Refaire prepare.')
        if row['data'].get('translations', {}) != task['translations']:
            raise ValueError('Le texte de référence a été modifié dans le plan.')
        translated, paths = {}, []
        for lang, fields in proposed.items():
            if lang not in languages or lang == plan['source'] or not isinstance(fields, dict):
                raise ValueError('Langue cible non autorisée.')
            values = {}
            for field, text in fields.items():
                if field not in FIELDS or not isinstance(text, str) or not text.strip():
                    raise ValueError('Seuls title/description avec un texte non vide sont acceptés.')
                old = row['data'].get('translations', {}).get(lang, {}).get(field, '')
                if text == old:
                    continue
                if old.strip() and not overwrite:
                    raise ValueError(f'{cid}/{lang}/{field} existe déjà. --overwrite requis pour le remplacer.')
                values[field] = {'stringValue': text}
                paths.append(f'translations.{lang}.{field}')
            if values:
                translated[lang] = {'mapValue': {'fields': values}}
        if paths:
            writes.append({'update': {'name': ROOT + '/post-pages/' + cid,
                          'fields': {'translations': {'mapValue': {'fields': translated}}}},
                          'updateMask': {'fieldPaths': paths},
                          'currentDocument': {'updateTime': task['updateTime']},
                          'updateTransforms': [{'fieldPath': 'updatedAt', 'setToServerValue': 'REQUEST_TIME'}]})
    if len(writes) > 450:
        raise ValueError('Plus de 450 messages : préparer plusieurs lots explicites.')
    return writes


def save_private(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as out:
        json.dump(value, out, ensure_ascii=False, indent=2)
        out.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('list', help='Lister les dossiers de posts et les messages (lecture seule).')
    prep = commands.add_parser('prepare', help='Exporter les textes à traduire, sans modifier Firestore.')
    prep.add_argument('--post-folder', help='Nom exact ou ID du dossier dans Posts.')
    prep.add_argument('--post', action='append', help='ID ou titre du post, répétable.')
    prep.add_argument('--page', action='append', help='ID ou titre exact, répétable.')
    prep.add_argument('--all', action='store_true', help='Tous les messages, explicitement.')
    prep.add_argument('--languages', default='all')
    prep.add_argument('--source', default='fr')
    prep.add_argument('--out', required=True)
    apply = commands.add_parser('apply', help='Vérifier un plan; --write est nécessaire pour enregistrer.')
    apply.add_argument('--file', required=True)
    apply.add_argument('--write', action='store_true')
    apply.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    client = Firestore()
    if args.command == 'apply':
        plan = json.loads(Path(args.file).read_text())
        rows = {task['id']: client.get(task['id']) for task in plan['pages'] if task.get('proposed')}
        writes = build_writes(plan, rows, args.overwrite)
        if args.write and writes:
            backup = Path(__file__).resolve().parents[1] / 'work' / 'translation-audit' / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
            save_private(backup, {'before': rows, 'writes': writes, 'status': 'prepared'})
            result = client.request(':commit', {'writes': writes})
            save_private(backup, {'before': rows, 'writes': writes, 'status': 'committed', 'commitTime': result.get('commitTime')})
        print(json.dumps({'mode': 'written' if args.write else 'dry-run', 'pageCount': len(writes),
                          'fields': [{'id': w['update']['name'].rsplit('/', 1)[-1], 'paths': w['updateMask']['fieldPaths']} for w in writes]}, ensure_ascii=False, indent=2))
        return
    pages = client.list('post-pages')
    posts = client.list('posts')
    folders = client.list('post-folders')
    if args.command == 'list':
        print(json.dumps({'postFolders': [{'id': row['id'], 'name': row['data'].get('name', '')} for row in folders],
                          'posts': [{'id': row['id'], 'folderId': row['data'].get('folderId', ''), 'pageIds': row['data'].get('pageIds', [])} for row in posts],
                          'pages': [{'id': row['id'], 'postId': row['data']['postId'], 'title': title(row)} for row in pages]}, ensure_ascii=False, indent=2))
        return
    if not args.all and not args.post_folder and not args.page and not args.post:
        raise ValueError('Préciser --post-folder, --post, --page ou --all.')
    source = language_list(args.source)
    if len(source) != 1: raise ValueError('Une seule langue source est nécessaire.')
    rows = select_pages(pages, posts, folders, args.post_folder, args.page, args.post)
    plan = prepare(rows, language_list(args.languages), source[0])
    save_private(args.out, plan)
    print(json.dumps({'file': args.out, 'pageCount': len(rows), 'withMissingFields': sum(bool(t['missing']) for t in plan['pages'])}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print('Erreur : ' + str(error), file=sys.stderr)
        sys.exit(1)

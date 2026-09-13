#!/usr/bin/env python3
"""One-time conversion to posts owning ordered pages with embedded translations.
Read-only by default. --write saves raw documents before a conditional atomic commit.
"""
import argparse
import copy
import importlib.util
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from uuid import uuid5, NAMESPACE_URL

spec = importlib.util.spec_from_file_location('post_translations', Path(__file__).with_name('post-translations.py'))
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
OLD = ('campaigns', 'messages', 'campaign-folders', 'creations', 'creation-folders')
COLLECTIONS = (*OLD, 'posts', 'post-pages', 'post-folders', 'publication-schedules', 'publication-plans')

def raw_list(client, collection):
    rows, token = [], ''
    while True:
        result = client.request('/' + collection + '?' + urlencode({'pageSize': 300, 'pageToken': token}))
        rows.extend(result.get('documents', [])); token = result.get('nextPageToken', '')
        if not token: return rows

def val(raw, field, default=None):
    return api.unpack(raw.get('fields', {}).get(field, {})) if field in raw.get('fields', {}) else default

def ident(raw): return raw['name'].rsplit('/', 1)[-1]
def path(collection, id): return api.ROOT + '/' + collection + '/' + id
def uid(value): return uuid5(NAMESPACE_URL, 'adstudio/owned-pages/' + value).hex

def pack(value):
    if isinstance(value, str): return {'stringValue': value}
    if isinstance(value, bool): return {'booleanValue': value}
    if isinstance(value, int): return {'integerValue': str(value)}
    if isinstance(value, float): return {'doubleValue': value}
    if isinstance(value, list): return {'arrayValue': {'values': [pack(x) for x in value]} if value else {}}
    if isinstance(value, dict): return {'mapValue': {'fields': {k: pack(v) for k, v in value.items()}} if value else {}}
    raise ValueError('Unsupported value')

EMPTY = pack({lang: {'title': '', 'description': ''} for lang in ('en', 'fr', 'pt')})
def page_text(message):
    return copy.deepcopy(message['fields']['translations']) if message else copy.deepcopy(EMPTY)

def build_plan(before, layout):
    if before['post-pages'] or before['post-folders'] or not before['messages']:
        raise ValueError('La conversion a déjà eu lieu ou la base source est inattendue.')
    source_pages = {ident(row): row for row in before['creations']}
    messages = {ident(row): row for row in before['messages']}
    expected = {key: {} for key in ('posts', 'post-pages', 'post-folders')}
    used, owned = set(), set()
    old_post_by_id = {ident(row): row for row in before['posts']}
    # Copy every folder including intentionally empty folders. Reuse an exact matching post folder name.
    folders = {ident(row): copy.deepcopy(row['fields']) for row in before['creation-folders']}
    expected['post-folders'].update(folders)
    mapped = {'': ''}
    for row in before['campaign-folders']:
        matches = [id for id, fields in folders.items() if api.unpack(fields['name']) == val(row, 'name')]
        id = matches[0] if len(matches) == 1 else uid('folder/' + ident(row))
        mapped[ident(row)] = id
        if id not in expected['post-folders']: expected['post-folders'][id] = copy.deepcopy(row['fields'])
    post_message_orders = []
    for post in before['posts']:
        ids = val(post, 'pageIds', [])
        if not ids or len(ids) > 10 or len(set(ids)) != len(ids): raise ValueError('Ordre de pages invalide.')
        fields = copy.deepcopy(post['fields']); fields.pop('campaignId', None); fields.pop('type', None)
        expected['posts'][ident(post)] = fields
        mids = []
        for id in ids:
            if id not in source_pages or id in owned: raise ValueError('Page absente ou partagée entre posts.')
            owned.add(id)
            page = source_pages[id]
            mid = val(page, 'messageId', '')
            if mid and mid not in messages: raise ValueError('Texte référencé introuvable.')
            if mid: used.add(mid); mids.append(mid)
            fields = copy.deepcopy(page['fields'])
            fields.pop('messageId', None); fields.pop('folderId', None)
            fields['postId'] = pack(ident(post)); fields['translations'] = page_text(messages.get(mid))
            expected['post-pages'][id] = fields
        post_message_orders.append(list(dict.fromkeys(mids)))
    if set(source_pages) != owned: raise ValueError('Pages sans post : examiner la base avant conversion.')
    now = {'timestampValue': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}
    def draft(key, mids, folder, name=''):
        if not mids: return
        if len(mids) > 10: raise ValueError('Un groupe non publié dépasse dix pages.')
        post_id = uid('draft/' + key)
        ids = []
        for index, mid in enumerate(mids):
            if mid not in messages: raise ValueError('Texte de brouillon introuvable.')
            used.add(mid); page_id = uid('draft-page/' + key + '/' + str(index)); ids.append(page_id)
            template = next((row for row in source_pages.values() if val(row, 'messageId') == mid), None)
            fields = copy.deepcopy(template['fields']) if template else {
                'name': pack(name or 'Nouvelle page'), 'format': pack('portrait'), 'theme': pack('dailydish'),
                'background': pack('cream'), 'backgroundAssetId': pack(''), 'properties': pack(layout),
                'ownerEmail': pack('mydailydishapp@gmail.com'), 'createdAt': now, 'updatedAt': now,
            }
            fields.pop('messageId', None); fields.pop('folderId', None)
            fields['postId'] = pack(post_id); fields['translations'] = page_text(messages[mid])
            expected['post-pages'][page_id] = fields
        expected['posts'][post_id] = {'pageIds': pack(ids), 'folderId': pack(folder), 'ownerEmail': pack('mydailydishapp@gmail.com'), 'createdAt': now, 'updatedAt': now}
    # Preserve any unrepresented message ordering as a draft post, including text-only groups.
    for group in before['campaigns']:
        mids = val(group, 'messageIds', [])
        if mids not in post_message_orders:
            draft('group/' + ident(group), mids, mapped.get(val(group, 'folderId', ''), ''), val(group, 'name', ''))
    for mid in messages.keys() - used:
        draft('message/' + mid, [mid], mapped.get(val(messages[mid], 'folderId', ''), ''))
    writes = []
    for collection, items in expected.items():
        for id, fields in items.items():
            old = old_post_by_id.get(id) if collection == 'posts' else None
            precondition = {'updateTime': old['updateTime']} if old else {'exists': False}
            writes.append({'update': {'name': path(collection, id), 'fields': fields}, 'currentDocument': precondition})
    for collection in OLD:
        writes.extend({'delete': row['name'], 'currentDocument': {'updateTime': row['updateTime']}} for row in before[collection])
    if len(writes) > 500: raise ValueError('Trop de documents pour une conversion atomique.')
    return writes, expected

def verify(before, after, expected):
    for collection in OLD:
        assert not after[collection], 'Ancienne collection non vide : ' + collection
    for collection, values in expected.items():
        actual = {ident(row): row['fields'] for row in after[collection]}
        assert actual == values, 'Données modifiées ou manquantes : ' + collection
    assert before['publication-plans'] == after['publication-plans'], 'Calendrier modifié'
    for row in before['creations']:
        old_layout = {k: v for k, v in row['fields'].items() if k not in ('messageId', 'folderId', 'postId')}
        new_layout = {k: v for k, v in expected['post-pages'][ident(row)].items() if k not in ('translations', 'postId')}
        assert old_layout == new_layout, 'Layout modifié'
    all_text = [fields['translations'] for fields in expected['post-pages'].values()]
    for row in before['messages']: assert row['fields']['translations'] in all_text, 'Texte perdu'

def version(timestamp):
    seconds = int(datetime.fromisoformat(timestamp.replace('Z', '+00:00')).timestamp())
    fraction = timestamp.partition('.')[2].rstrip('Z')
    return f"{seconds}:{int((fraction + '000000000')[:9]) if fraction else 0}"

def prepared_writes(before, after):
    old_docs = {row['name'].split('/documents/')[1]: row for rows in before.values() for row in rows}
    new_docs = {row['name'].split('/documents/')[1]: row for rows in after.values() for row in rows}
    writes = []
    for row in before['publication-schedules']:
        if val(row, 'status') != 'ready': continue
        old_versions = val(row, 'versions', {})
        valid = bool(old_versions) and all(key in old_docs and value == version(old_docs[key]['updateTime']) for key, value in old_versions.items())
        # Never bless exports that were already stale before migration.
        if not valid: continue
        post_id = val(row, 'postId'); post = new_docs.get('posts/' + post_id)
        if not post: continue
        paths = ['posts/' + post_id] + ['post-pages/' + id for id in val(post, 'pageIds', [])]
        values = {key: version(new_docs[key]['updateTime']) for key in paths}
        clients = {key: int(datetime.fromisoformat(val(new_docs[key], 'updatedAt').replace('Z', '+00:00')).timestamp() * 1000) for key in paths}
        writes.append({'update': {'name': row['name'], 'fields': {'versions': pack(values), 'clientVersions': pack(clients)}}, 'updateMask': {'fieldPaths': ['versions', 'clientVersions']}, 'currentDocument': {'updateTime': row['updateTime']}})
    return writes

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true'); parser.add_argument('--snapshot', help='Offline audit of an existing backup')
    args = parser.parse_args()
    layout = json.loads(subprocess.check_output(['node', str(Path(__file__).with_name('page-defaults.mjs'))]))
    client = None if args.snapshot else api.Firestore()
    before = json.loads(Path(args.snapshot).read_text()) if args.snapshot else {key: raw_list(client, key) for key in COLLECTIONS}
    for key in COLLECTIONS: before.setdefault(key, [])
    writes, expected = build_plan(before, layout)
    print(json.dumps({'counts': {key: len(rows) for key, rows in expected.items()}, 'writes': len(writes), 'newDrafts': len(expected['posts']) - len(before['posts'])}))
    if args.write:
        if not client: raise ValueError('--write ne peut pas utiliser un ancien snapshot.')
        backup = Path(__file__).resolve().parents[1] / 'work' / ('before-owned-pages-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
        api.save_private(backup, before)
        client.request(':commit', {'writes': writes})
        after = {key: raw_list(client, key) for key in COLLECTIONS}
        verify(before, after, expected)
        prepared = prepared_writes(before, after)
        if prepared: client.request(':commit', {'writes': prepared})
        api.save_private(backup.with_suffix('.result.json'), {'expected': expected, 'verified': True, 'preparedSchedules': len(prepared)})
        print(json.dumps({'verified': True, 'backup': str(backup), 'preservedPreparedSchedules': len(prepared)}))

if __name__ == '__main__': main()

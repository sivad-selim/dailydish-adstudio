import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('translations', Path(__file__).parents[1] / 'scripts/campaign-translations.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def campaign(cid='c1'):
    return {'id': cid, 'updateTime': '2026-09-12T00:00:00Z', 'data': {'translations': {'fr': {'title': 'Titre', 'description': ''}, 'en': {'title': '', 'description': 'Keep'}, 'pt': {'title': '', 'description': ''}}, 'folderId': 'unchanged'}}


class TranslationTests(unittest.TestCase):
    def test_gallery_resolves_shared_campaign_once_and_ignores_stale_page_folder(self):
        rows = [campaign()]
        posts = [{'id': 'p', 'data': {'folderId': 'f', 'pageIds': ['a', 'b']}}]
        pages = [{'id': page, 'data': {'campaignId': 'c1', 'folderId': 'old'}} for page in ['a', 'b']]
        folders = [{'id': 'f', 'data': {'name': 'Collection'}}]
        self.assertEqual(m.select_campaigns(rows, posts, pages, folders, 'Collection'), rows)
        with self.assertRaises(ValueError):
            m.select_campaigns(rows, posts, pages[:1], folders, 'Collection')

    def test_ambiguous_name_fails_and_br_maps_to_pt(self):
        with self.assertRaises(ValueError):
            m.resolve([campaign(), campaign('c2')], 'Titre', m.title)
        self.assertEqual(m.language_list('EN,BR,pt'), ['en', 'pt'])

    def test_optional_empty_description_is_not_missing(self):
        plan = m.prepare([campaign()], ['en', 'pt'], 'fr')
        self.assertEqual(plan['campaigns'][0]['missing'], {'en': ['title'], 'pt': ['title']})

    def test_field_mask_preserves_other_data_and_uses_atomic_precondition(self):
        row = campaign()
        plan = m.prepare([row], ['en'], 'fr')
        plan['campaigns'][0]['proposed'] = {'en': {'title': 'Title'}}
        writes = m.build_writes(plan, {'c1': row})
        self.assertEqual(writes[0]['updateMask']['fieldPaths'], ['translations.en.title'])
        self.assertEqual(writes[0]['currentDocument'], {'updateTime': row['updateTime']})
        self.assertNotIn('folderId', writes[0]['update']['fields'])
        row['updateTime'] = 'new'
        with self.assertRaises(ValueError):
            m.build_writes(plan, {'c1': row})

    def test_overwrite_and_source_protection(self):
        row = campaign()
        plan = m.prepare([row], ['en', 'fr'], 'fr')
        plan['campaigns'][0]['proposed'] = {'en': {'description': 'Changed'}}
        with self.assertRaises(ValueError):
            m.build_writes(plan, {'c1': row})
        self.assertEqual(len(m.build_writes(plan, {'c1': row}, True)), 1)
        plan['campaigns'][0]['proposed'] = {'fr': {'title': 'Changed'}}
        with self.assertRaises(ValueError):
            m.build_writes(plan, {'c1': row}, True)

    def test_unrequested_language_and_empty_text_rejected(self):
        row = campaign()
        plan = m.prepare([row], ['en'], 'fr')
        for proposed in [{'pt': {'title': 'Titulo'}}, {'en': {'title': ''}}, {'en': {'folderId': 'other'}}]:
            plan['campaigns'][0]['proposed'] = proposed
            with self.assertRaises(ValueError):
                m.build_writes(plan, {'c1': row})

if __name__ == '__main__':
    unittest.main()

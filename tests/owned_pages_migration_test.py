import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('migration', Path(__file__).parents[1] / 'scripts/migrate-owned-pages.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
TIME = '2026-09-12T20:00:00.000000Z'
def row(collection, id, fields):
    packed = {key: m.pack(value) for key, value in fields.items()}
    packed['updatedAt'] = {'timestampValue': TIME}
    return {'name':m.path(collection,id),'fields':packed,'updateTime':TIME}
def fixture():
    data = {key:[] for key in m.COLLECTIONS}
    data['messages'] = [row('messages','shared',{'translations':{lang:{'title':'Title '+lang,'description':''} for lang in ('en','fr','pt')}}),row('messages','unused',{'folderId':'text-folder','translations':{'en':{'title':'Unused','description':'Keep me'},'fr':{'title':'','description':''},'pt':{'title':'','description':''}}})]
    data['campaign-folders'] = [row('campaign-folders','text-folder',{'name':'Ideas'})]
    data['creation-folders'] = [row('creation-folders','folder',{'name':'Published','postOrder':['post']})]
    data['posts'] = [row('posts','post',{'pageIds':['a','b'],'type':'gallery','folderId':'folder','campaignId':'old-group'})]
    data['creations'] = [row('creations',id,{'name':'Page '+id,'postId':'post','folderId':'stale-folder','messageId':'shared','format':'story','properties':{'images':[{'assetId':'image-'+id,'x':27.4,'rotation':12}],'textWidth':82}}) for id in ('a','b')]
    data['publication-plans'] = [row('publication-plans','main',{'entries':[{'id':'entry','postId':'post','date':'2026-09-14','scheduleRevision':'keep'}]})]
    return data
class MigrationTests(unittest.TestCase):
    def test_shared_text_becomes_independent_and_unused_text_is_recovered(self):
        before = fixture(); untouched=copy.deepcopy(before)
        writes, expected=m.build_plan(before,{'images':[]})
        self.assertEqual(before,untouched)
        self.assertEqual(len(expected['posts']),2)
        self.assertEqual(len(expected['post-pages']),3)
        self.assertNotIn('type',expected['posts']['post'])
        self.assertEqual(m.api.unpack(expected['posts']['post']['pageIds']),['a','b'])
        a=expected['post-pages']['a'];b=expected['post-pages']['b']
        self.assertEqual(a['translations'],b['translations']);self.assertIsNot(a['translations'],b['translations'])
        self.assertEqual(a['properties'],before['creations'][0]['fields']['properties'])
        self.assertTrue(all('currentDocument' in write for write in writes))
        after={key:[] for key in m.COLLECTIONS}
        for collection, values in expected.items():after[collection]=[{'name':m.path(collection,id),'fields':fields} for id,fields in values.items()]
        after['publication-plans']=copy.deepcopy(before['publication-plans'])
        m.verify(before,after,expected)
    def test_changed_order_of_unpublished_group_is_preserved(self):
        data=fixture();data['campaigns']=[row('campaigns','group',{'messageIds':['unused','shared'],'folderId':'text-folder'})]
        _,expected=m.build_plan(data,{})
        draft=next(fields for id,fields in expected['posts'].items() if id!='post')
        ids=m.api.unpack(draft['pageIds'])
        self.assertEqual(len(ids),2)
        self.assertEqual(expected['post-pages'][ids[0]]['translations'],data['messages'][1]['fields']['translations'])
    def test_missing_shared_and_duplicate_pages_abort_without_mutating_source(self):
        for edit in ('missing','duplicate','orphan','missing-text'):
            data=fixture()
            if edit=='missing':data['creations'].pop()
            if edit=='duplicate':data['posts'].append(row('posts','other',{'pageIds':['a']}))
            if edit=='orphan':data['posts'][0]['fields']['pageIds']=m.pack(['a'])
            if edit=='missing-text':data['messages']=data['messages'][1:]
            with self.assertRaises(ValueError):m.build_plan(data,{})
    def test_rerun_is_refused(self):
        data=fixture();data['post-pages']=[{}]
        with self.assertRaises(ValueError):m.build_plan(data,{})
    def test_stale_exports_are_not_revalidated(self):
        data=fixture();data['publication-schedules']=[row('publication-schedules','s',{'status':'ready','postId':'post','versions':{'messages/shared':'wrong'}})]
        self.assertEqual(m.prepared_writes(data,{}),[])
if __name__=='__main__':unittest.main()

import { activeDirectoryPersonIds } from '../lib/members/directory-assignments.ts'
import assert from 'node:assert/strict'
import { mergeArchivedEntries } from '../lib/members/archived-entries.ts'
const archived=(id,person,date)=>({id,legacy_people_id:person,preferred_display_name:'Preferred',archived_at:date,lifecycle_state:'archived'})
const ended=(id,person,date)=>({id,person_id:person,ended_at:date})
const entries=mergeArchivedEntries([
 archived('old','member','2026-01-01'),archived('new','member','2026-02-01'),
 archived('legacy','legacy-only','2026-01-01'),
], [ended('assignment','member','2026-03-01'),ended('vol','volunteer','2026-04-01'),ended('pros','prospect','2026-05-01'),ended('active','active',null)])
assert.equal(entries.length,4)
assert.deepEqual(entries.map(x=>x.legacy_people_id),['prospect','volunteer','member','legacy-only'])
assert.equal(entries.find(x=>x.legacy_people_id==='member').preferred_display_name,'Preferred')
assert.equal(entries.find(x=>x.legacy_people_id==='member').archived_at,'2026-03-01')
assert.deepEqual(mergeArchivedEntries([],[]),[])
console.log('Archive listing: assignment-only entries, legacy entries, duplicates, ordering and active exclusion passed.')

assert.deepEqual(mergeArchivedEntries([archived('old','restored','2026-01-01')],[ended('old-link','restored','2026-01-01'),ended('new-link','restored',null)]),[])
assert.deepEqual(mergeArchivedEntries([archived('old','legacy-restored','2026-01-01'),{...archived('active','legacy-restored',null),lifecycle_state:'active'}],[]),[])

assert.deepEqual(activeDirectoryPersonIds(['legacy','ended','member'],[{person_id:'ended',ended_at:'2026-01-01'},{person_id:'member',ended_at:null},{person_id:'volunteer',ended_at:null}]),['legacy','member','volunteer'])

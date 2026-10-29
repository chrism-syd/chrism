import assert from 'node:assert/strict'
import { matchingFields, findPersonMatches, findDuplicatePairs, normalizeMatchPhone } from '../lib/people-reviews/matching.ts'
const person=(id,extra={})=>({id,first_name:'Mark',last_name:'Angelini',...extra})
assert.deepEqual(matchingFields(person('one',{middle_name:'P'}),person('two')),['name'])
assert.deepEqual(findPersonMatches(person('incoming',{member_number:'4148022'}),[
  person('one',{member_number:'04148022'}),person('two')]).map(match=>match.person.id),['one','two'])
assert.deepEqual(matchingFields(person('one',{first_name:'Éric',last_name:'D’Souza'}),person('two',{first_name:'eric',last_name:'D Souza'})),['name'])
assert.ok(matchingFields(person('one',{first_name:'Other',email:'MARK@example.org'}),person('two',{email:' mark@example.org '})).includes('email'))
assert.ok(matchingFields(person('one',{first_name:'Other',cell_phone:'+1 (416) 555-0100'}),person('two',{home_phone:'416-555-0100'})).includes('phone'))
assert.equal(normalizeMatchPhone('+1 (416) 555-0100'),'4165550100')
assert.deepEqual(matchingFields(person('one',{first_name:'Other',city:'Markham',postal_code:'L6B0A1'}),person('two',{city:'MARKHAM',postal_code:'L6B 0A1'})),[])
assert.ok(matchingFields(person('one',{first_name:'Other',address_line_1:'12 Main St.',postal_code:'L6B0A1'}),person('two',{address_line_1:'12 MAIN ST',postal_code:'L6B 0A1'})).includes('address'))
assert.deepEqual(matchingFields(person('one',{first_name:'Other',birth_date:'1970-01-01'}),person('two',{birth_date:'1970-01-01'})),[])
assert.deepEqual(findPersonMatches(person('one'),[person('one')]),[])
assert.equal(findDuplicatePairs([person('row1'),person('row2'),person('row3',{first_name:'Different'})]).length,1)
assert.deepEqual(matchingFields({id:'a',first_name:'',last_name:''},{id:'b',first_name:'',last_name:''}),[])
console.log('People matching: aggregate candidates, names, padding, accents, email, cross-phone fields, addresses, empty fields, shared locations and batch pairs passed.')

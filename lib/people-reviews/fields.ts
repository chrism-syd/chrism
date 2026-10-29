import { IMPORT_FIELD_DEFINITIONS, existingFieldValues, type ExistingSupremeComparablePerson } from '@/lib/imports/supreme'
import { type ReviewInput } from './queue'
export function reviewFields(input: ReviewInput) {
  const core = [{key:'first_name',label:'First name'},{key:'middle_name',label:'Middle name'},{key:'last_name',label:'Last name'},
    {key:'email',label:'Email'},{key:'cell_phone',label:'Cell phone'},{key:'home_phone',label:'Home phone'},{key:'other_phone',label:'Other phone'},
    {key:'address_line_1',label:'Street address'},{key:'address_line_2',label:'Address line 2'},{key:'city',label:'City'},
    {key:'state_province',label:'Province / state'},{key:'postal_code',label:'Postal code'}]
  if (input.kind === 'roster') return [...IMPORT_FIELD_DEFINITIONS,{key:'home_phone',label:'Home phone'},{key:'other_phone',label:'Other phone'}]
  return core
}
export function incomingValues(input: ReviewInput): Record<string,string|null> {
  if (input.kind === 'existing') return {}
  return input.kind === 'roster' ? {...input.fieldValues,home_phone:input.home_phone??null,other_phone:input.other_phone??null} : {...input.values}
}
export function currentValues(person: ExistingSupremeComparablePerson | null): Record<string,string|null> {
  return {...existingFieldValues(person),address_line_2:person?.address_line_2??null,home_phone:person?.home_phone??null,other_phone:person?.other_phone??null}
}
export const peopleFieldKeys = ['title','first_name','middle_name','last_name','suffix','email','cell_phone','home_phone','other_phone',
  'address_line_1','address_line_2','city','state_province','postal_code','birth_date']

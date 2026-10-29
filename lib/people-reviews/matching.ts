export type MatchPerson = {
  id: string; first_name: string; middle_name?: string | null; last_name: string;
  member_number?: string | null; email?: string | null; cell_phone?: string | null;
  home_phone?: string | null; other_phone?: string | null; address_line_1?: string | null;
  city?: string | null; postal_code?: string | null; birth_date?: string | null;
}
export const matchLabels: Record<string, string> = {
  member_number: 'Member number', name: 'First and last name', email: 'Email',
  phone: 'Phone', address: 'Street address and location', birth_date: 'Birth date',
}
export const normalizeMatchText = (value?: string | null) => (value ?? '').normalize('NFKD')
  .replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
export const normalizeMatchNumber = (value?: string | null) => normalizeMatchText(value).replace(/^0+(?=\d)/, '')
export function normalizeMatchPhone(value?: string | null) {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}
const equal = (a?: string | null, b?: string | null) => Boolean(normalizeMatchText(a)) && normalizeMatchText(a) === normalizeMatchText(b)
export function matchingFields(a: MatchPerson, b: MatchPerson): string[] {
  const fields: string[] = []
  if (normalizeMatchNumber(a.member_number) && normalizeMatchNumber(a.member_number) === normalizeMatchNumber(b.member_number)) fields.push('member_number')
  if (equal(a.first_name, b.first_name) && equal(a.last_name, b.last_name)) fields.push('name')
  if (a.email?.trim() && a.email.trim().toLowerCase() === b.email?.trim().toLowerCase()) fields.push('email')
  const phones = (p: MatchPerson) => [p.cell_phone, p.home_phone, p.other_phone].map(normalizeMatchPhone).filter(p => p.length >= 7)
  if (phones(a).some(phone => phones(b).includes(phone))) fields.push('phone')
  if (equal(a.address_line_1, b.address_line_1) && (equal(a.postal_code, b.postal_code) || equal(a.city, b.city))) fields.push('address')
  // Birth date alone, a shared city, a shared surname, and empty fields are not identity evidence.
  if (fields.length && a.birth_date && a.birth_date === b.birth_date) fields.push('birth_date')
  return fields
}
export function findPersonMatches<T extends MatchPerson>(incoming: MatchPerson, people: T[]) {
  return people.filter(person => person.id !== incoming.id)
    .map(person => ({ person, fields: matchingFields(incoming, person) }))
    .filter(match => match.fields.length > 0)
}
export function findDuplicatePairs<T extends MatchPerson>(people: T[]) {
  return people.flatMap((person, index) => findPersonMatches(person, people.slice(index + 1))
    .map(match => ({ left: person, right: match.person, fields: match.fields })))
}

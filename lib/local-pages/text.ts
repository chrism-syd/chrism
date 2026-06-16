const SAINT_PREFIX_PATTERN = /\bSt\.\s+/g
const LAST_TWO_WORDS_PATTERN = /(\S+)\s+(\S+)$/

export function bindSaintNames(text: string) {
  return text.replace(SAINT_PREFIX_PATTERN, 'St.\u00a0')
}

export function preventParagraphOrphans(text: string) {
  return bindSaintNames(text).replace(LAST_TWO_WORDS_PATTERN, '$1\u00a0$2')
}

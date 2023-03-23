import { err } from '../util/err'

const IS_ASCII_DIGIT = /[0-9]/u
const NO_ASCII_HEXDIGIT = /[^0-9a-fA-F]/u
const IS_LETTER = /\p{Alpha}/u
const NO_WORD_CHAR = /[^\p{Alpha}\p{M}\p{Nd}_]/u

const DOUBLE_QUOTED_STRING = /^"(?:\\[\s\S]|[^\\"])*"?/u

export const enum Token {
  /** Start assertion `^` */
  Caret,
  /** End assertion `$` */
  Dollar,
  /** Angle brackets for lookahead assertion `>>` */
  LookAhead,
  /** Angle brackets for lookbehind assertion `<<` */
  LookBehind,
  /** Double colon for backreference `::` */
  Backref,
  /** word boundary `%` */
  BWord,
  /** Zero or more repetition `*` */
  Star,
  /** One or more repetition `+` */
  Plus,
  /** Zero or one repetition `?` */
  QuestionMark,
  /** Alternation `|` */
  Pipe,
  /** Colon for capturing group name `:` */
  Colon,
  /** Opening parenthesis (group start) `(` */
  OpenParen,
  /** Closing parenthesis (group end) `)` */
  CloseParen,
  /** Opening brace (repetition start) `{` */
  OpenBrace,
  /** Closing brace (repetition end) `}` */
  CloseBrace,
  /** Comma in repetition `,` */
  Comma,
  /** Exclamation mark for negation `!` */
  Not,
  /** Opening bracket for character sets `[` */
  OpenBracket,
  /** Dash/minus for character ranges `-` */
  Dash,
  /** Closing bracket for character sets `]` */
  CloseBracket,
  /** Dot for matching everything except line breaks `.` */
  Dot,
  /** Statement ending `;` */
  Semicolon,
  /** Variable assignment `=` */
  Equals,
  /** String literal `"..."` */
  String,
  /** Hexadecimal codepoint literal `U+12345` */
  CodePoint,
  /** Number literal `12345` */
  Number,
  /** Variable or group name `foobar` */
  Identifier,
}

interface TokenError {
  error: string
}

type TokenOrError = Token | TokenError

export function tokenizePomsky(input: string): [TokenOrError, number, number][] {
  const result: [Token | TokenError, number, number][] = []
  let offset = 0

  for (;;) {
    const inputLen = input.length
    input = input.replace(/^(\s*|#.*)*/u, '')
    offset += inputLen - input.length

    if (input.length === 0) {
      break
    }

    const [len, token] = consumeChain(input)

    const start = offset
    offset += len
    input = input.slice(len)
    result.push([token, start, offset])
  }

  return result
}

const singleTokens: { [token: string]: Token | TokenError } = {
  $: Token.Dollar,
  '^': Token.Caret,
  '%': Token.BWord,
  '*': Token.Star,
  '+': Token.Plus,
  '?': Token.QuestionMark,
  '|': Token.Pipe,
  ':': Token.Colon,
  '(': Token.OpenParen,
  ')': Token.CloseParen,
  '{': Token.OpenBrace,
  '}': Token.CloseBrace,
  ',': Token.Comma,
  '!': Token.Not,
  '[': Token.OpenBracket,
  '-': Token.Dash,
  ']': Token.CloseBracket,
  '.': Token.Dot,
  ';': Token.Semicolon,
  '=': Token.Equals,
}

// eslint-disable-next-line complexity
function consumeChain(input: string): [number, Token | TokenError] {
  const char = input[0]

  if (input.startsWith('>>')) return [2, Token.LookAhead]
  if (input.startsWith('<<')) return [2, Token.LookBehind]
  if (input.startsWith('::')) return [2, Token.Backref]

  if (char in singleTokens) return [1, singleTokens[char]]

  if (char === "'") {
    const lenInner = input.slice(1).indexOf("'")
    if (lenInner === -1) {
      return [input.length, { error: 'UnclosedString' }]
    } else {
      return [lenInner + 2, Token.String]
    }
  }

  if (char === '"') {
    const len = findLengthOfDoubleQuotedString(input)
    if (len !== undefined) {
      return [len, Token.String]
    } else {
      return [input.length, { error: 'UnclosedString' }]
    }
  }

  if (input.startsWith('U+')) {
    const rest = input.slice(2)
    const lenInner = rest.search(NO_ASCII_HEXDIGIT)
    if (lenInner === -1) {
      return [input.length, Token.CodePoint]
    } else if (lenInner === 0) {
      return [1, { error: 'MissingCodePointNumber' }]
    } else {
      return [lenInner + 2, Token.CodePoint]
    }
  }

  if (IS_ASCII_DIGIT.test(char)) {
    const numLength = input.search(NO_WORD_CHAR)
    return [numLength === -1 ? input.length : numLength, Token.Number]
  }

  if (IS_LETTER.test(char) || char === '_') {
    const wordLength = input.search(NO_WORD_CHAR)
    return [wordLength === -1 ? input.length : wordLength, Token.Identifier]
  }

  return [1, { error: 'Unknown' }]
}

function findLengthOfDoubleQuotedString(input: string): number | undefined {
  DOUBLE_QUOTED_STRING.lastIndex = 0
  const res = DOUBLE_QUOTED_STRING.exec(input) ?? err('quote not found')
  return res[0].length
}

/**
 * Binary search for the closest token at the given offset. The runtime is *O(log n)* with respect
 * to the total number of tokens.
 */
export function findClosestTokenIndex(
  tokens: [Token | TokenError, number, number][],
  offset: number,
): number {
  let lowerBound = 0
  let upperBound = tokens.length

  for (;;) {
    if (upperBound - lowerBound <= 1) {
      return lowerBound
    }

    const middle = (upperBound + lowerBound) >> 1
    const middleToken = tokens[middle]
    if (offset < middleToken[1]) {
      upperBound = middle
    } else if (offset > middleToken[2]) {
      lowerBound = middle
    } else if (offset === middleToken[1]) {
      // ___XXX___
      //   /\
      return middle > 0 && offset === tokens[middle - 1][2] ? middle - 1 : middle
    } else {
      // ___XXX___
      //    /##\
      return middle
    }
  }
}

const tokensAllowedInClass: Partial<Record<Token, true>> = {
  [Token.Not]: true,
  [Token.Dash]: true,
  [Token.Dot]: true,
  [Token.String]: true,
  [Token.CodePoint]: true,
  [Token.Identifier]: true,
}

export function isInCharacterSet(
  tokens: [Token | TokenError, number, number][],
  index: number,
  offset: number,
): boolean {
  const token = tokens[index]

  const previousTokens = tokens.slice(0, index + 1)
  if (token[1] >= offset) {
    previousTokens.pop()
  }
  for (let i = previousTokens.length - 1; i >= 0; i--) {
    const pt = previousTokens[i]
    if (pt[0] === Token.OpenBracket) {
      return true
    } else if (typeof pt[0] === 'number' && !tokensAllowedInClass[pt[0]]) {
      return false
    }
  }

  return false
}

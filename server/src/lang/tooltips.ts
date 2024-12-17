import { Hover, HoverParams, Range, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { connection, getInfo } from '../state'
import '../types.d'
import { unicodeName } from 'unicode-name'
import { Token } from '@pomsky-lang/parser'
import { findClosestTokenIndex } from './tokenUtils'

export function initTooltips(documents: TextDocuments<TextDocument>) {
  connection.onHover(({ position, textDocument }: HoverParams): Hover | undefined => {
    const model = documents.get(textDocument.uri)
    if (model === undefined) {
      return
    }

    const text = model.getText()
    const { tokens } = getInfo(model.uri, text, 'tokens')

    const offset = model.offsetAt(position) + 1
    const tokenIndex = findClosestTokenIndex(tokens, offset)

    if (tokenIndex < tokens.length) {
      const [tokenKind, wordStart, wordEnd] = tokens[tokenIndex]

      if (offset < wordStart || offset > wordEnd) {
        return
      }

      let contents: string | undefined
      switch (tokenKind) {
        case Token.Percent: {
          contents =
            '`%`, a word boundary.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/boundary/)'
          break
        }
        case Token.Caret: {
          contents =
            '`^`, a start of string assertion.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/boundary/)'
          break
        }
        case Token.Dollar: {
          contents =
            '`$`, an end of string assertion.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/boundary/)'
          break
        }
        case Token.AngleLeft: {
          contents =
            '`<`, a start of word assertion.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/boundary/)'
          break
        }
        case Token.AngleRight: {
          contents =
            '`>`, an end of word assertion.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/boundary/)'
          break
        }
        case Token.DoubleColon: {
          contents =
            '`::n`, a backreference or forward reference.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/reference/)'
          break
        }
        case Token.Not: {
          contents = `\`!\`, a negation.
~~~pomsky
!%       # negated word boundary
!['a']   # negated character set
!<< 'a'  # negative lookbehind
~~~

[Documentation](https://pomsky-lang.org/docs/reference/constructs/negation/)`
          break
        }
        case Token.Colon: {
          contents =
            'Capturing group.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/group/#capturing-groups)'
          break
        }
        case Token.Dot: {
          contents =
            '`.`, matching all codepoints except line breaks.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/dot/)'
          break
        }
        case Token.LookAhead: {
          contents =
            '`>>`, a lookahead assertion.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/lookaround/)'
          break
        }
        case Token.LookBehind: {
          contents =
            '`<<`, a lookbehind assertion.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/lookaround/)'
          break
        }
        case Token.Pipe: {
          contents =
            '`|`, an alternation.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/alternation/)'
          break
        }
        case Token.OpenBracket:
        case Token.CloseBracket: {
          contents =
            '`[···]`, a character set.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/charset/)'
          break
        }
        case Token.OpenBrace:
        case Token.CloseBrace: {
          contents =
            '`{a,b}`, a repetition.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/repetition/)'
          break
        }
        case Token.Star: {
          contents =
            '`*`, repeats the last expression zero times or more.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/repetition/)'
          break
        }
        case Token.Plus: {
          contents =
            '`+`, repeats the last expression once or more.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/repetition/)'
          break
        }
        case Token.QuestionMark: {
          contents =
            '`?`, makes the last expression optional.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/repetition/)'
          break
        }
        case Token.CodePoint:
        case Token.ReservedName:
        case Token.Identifier: {
          // create message later
          break
        }
        default:
          return
      }

      const range = offsetsToRange(model, wordStart, wordEnd)

      const content = model.getText(range)

      if (tokenKind === Token.CodePoint) {
        const hexString = content.replace(/^U\s*\+\s*/u, '')
        if (/^[0-9a-fA-F]{1,6}$/u.test(hexString)) {
          const codePoint = Number.parseInt(hexString, 16)

          const hex = codePoint.toString(16).toUpperCase().padStart(4, '0')
          const dec = codePoint.toString()
          const oct = codePoint.toString(8)

          let display: string
          try {
            display = String.fromCodePoint(codePoint)
          } catch {
            return
          }

          const name = unicodeName(display)
          const showName = name ? `**${name}**\\\n` : ''

          const isVisible = !/[\p{Other}\p{Separator}]/u.test(display)
          const heading = isVisible ? `## ${display}\n` : ''
          const description = `Code point \`U+${hex}\``

          const utf16CodeUnits = (codePoint > 0xffff ? [display[0], display[1]] : [display[0]]).map(
            s => s.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0'),
          )
          const utf16 = `\`${utf16CodeUnits.join(' ')}\``

          contents = `${heading}${showName}${description}\n\n- dec: ${dec}\n- oct: ${oct}\n- UTF-16: ${utf16}`
        }
      } else if (tokenKind === Token.Identifier) {
        contents = identToTooltip(content)
      } else if (tokenKind === Token.ReservedName) {
        contents = keywordToTooltip(content)
      }

      return contents === undefined ? undefined : { contents, range }
    }
  })
}

function offsetsToRange(model: TextDocument, startOffset: number, endOffset: number): Range {
  const start = model.positionAt(startOffset)
  const end = model.positionAt(endOffset)
  return { start, end }
}

function identToTooltip(ident: string): string | undefined {
  switch (ident) {
    case 'Start': {
      return `Start of string assertion; alias for \`^\`.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/boundary/)`
    }
    case 'End': {
      return `End of string assertion; alias for \`$\`.\n\n[Documentation](https://pomsky-lang.org/docs/reference/constructs/boundary/)`
    }
    case 'C':
    case 'Codepoint': {
      return `An arbitrary codepoint. Can be written as \`Codepoint\` or abbreviated as \`C\`.`
    }
    case 'G':
    case 'Grapheme': {
      return `An arbitrary [grapheme](https://pomsky-lang.org/docs/reference/constructs/variables/#built-in-variables),
which may consist of multiple codepoints. Can be written as \`Grapheme\` or abbreviated as \`G\`.`
    }
    default:
      return
  }
}

function keywordToTooltip(keyword: string): string | undefined {
  switch (keyword) {
    case 'let': {
      return `Declares a [variable](https://pomsky-lang.org/docs/reference/constructs/variables/).
Syntax:
~~~pomsky
let name = "expression";
name
~~~`
    }
    case 'range': {
      return `A [number range](https://pomsky-lang.org/docs/reference/constructs/number-range/),
which can match multi-digit numbers of any base. Syntax:
~~~pomsky
# match decimal numbers between 0 and 255
range '0'-'255'

# match hexadecimal numbers between 15 and FFF
range '15'-'FFF' base 16
~~~`
    }
    case 'atomic': {
      return `An [atomic group](https://pomsky-lang.org/docs/reference/constructs/group/#atomic-groups).
Syntax:
~~~pomsky
atomic('group content')
~~~`
    }
    case 'regex': {
      return `An [inline regular expression](https://pomsky-lang.org/docs/reference/constructs/inline-regex/).
Syntax:
~~~pomsky
regex '...'
~~~`
    }
    case 'lazy': {
      return `Makes the previous repetition [lazy](https://pomsky-lang.org/docs/language-tour/modifiers/#lazy-mode),
so it will match as few times as possible.
Syntax:
~~~pomsky
'...'* lazy
~~~`
    }
    case 'greedy': {
      return `Makes the previous repetition greedy, so it will match as many times as possible. Note that lazy
repetition is the default, so the \`greedy\` modifier is only needed in
[lazy mode](https://pomsky-lang.org/docs/language-tour/modifiers/#lazy-mode).
Syntax:
~~~pomsky
'...'* lazy
~~~`
    }
    case 'test': {
      return `Contains [unit tests](https://pomsky-lang.org/docs/reference/constructs/tests/). Syntax:
~~~pomsky
test {
  match 'foo';
  reject 'bar';
  # etc.
}
~~~`
    }
    case 'recursion': {
      return `[Recursion](https://pomsky-lang.org/docs/reference/constructs/recursion/) - matches the entire regex recursively.
Syntax:
~~~pomsky
# matches a balanced set of parentheses
'(' recursion* ')'
~~~
This is only supported in the PCRE and Ruby regex flavors.`
    }
    case 'U':
    case 'if':
    case 'else': {
      return `This keyword is reserved and can't be used as a variable name!`
    }
    default:
      return
  }
}

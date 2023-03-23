import { Hover, HoverParams, Range, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { findClosestTokenIndex, Token, tokenizePomsky } from './tokenizePomsky'
import { connection, documentInfo } from '../state'

export function initTooltips(documents: TextDocuments<TextDocument>) {
  connection.onHover(({ position, textDocument }: HoverParams): Hover | undefined => {
    const model = documents.get(textDocument.uri)
    if (model === undefined) {
      return
    }

    const text = model.getText()

    const docInfo = documentInfo[model.uri]
    const tokens =
      docInfo != null && docInfo.lastContent === text ? docInfo.tokens : tokenizePomsky(text)
    documentInfo[model.uri] = { lastContent: text, tokens }

    const offset = model.offsetAt(position)
    const tokenIndex = findClosestTokenIndex(tokens, offset)

    if (tokenIndex < tokens.length) {
      const [tokenKind, wordStart, wordEnd] = tokens[tokenIndex]

      if (offset < wordStart || offset > wordEnd) {
        return
      }

      let contents: string | undefined
      switch (tokenKind) {
        case Token.BWord: {
          contents =
            'Word boundary.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/boundaries/)'
          break
        }
        case Token.Backref: {
          contents =
            'Backreference or forward reference.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/references/)'
          break
        }
        case Token.Caret: {
          contents =
            'Start of string assertion.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/boundaries/)'
          break
        }
        case Token.Dollar: {
          contents =
            'End of string assertion.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/boundaries/)'
          break
        }
        case Token.Not: {
          contents = `Negation.
~~~pomsky
!%       # negated word boundary
!['a']   # negated character set
!<< 'a'  # negative lookbehind
~~~`
          break
        }
        case Token.Colon: {
          contents =
            'Capturing group.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/groups/)'
          break
        }
        case Token.Dash: {
          contents =
            'Codepoint range.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/character-classes/#character-ranges)'
          break
        }
        case Token.Dot: {
          contents =
            'Dot, matching all codepoints except line breaks.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/character-classes/#dot)'
          break
        }
        case Token.LookAhead: {
          contents =
            'Lookahead assertion.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/lookaround/)'
          break
        }
        case Token.LookBehind: {
          contents =
            'Lookbehind assertion.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/lookaround/)'
          break
        }
        case Token.Pipe: {
          contents =
            'Alternation.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/basics/#alternatives)'
          break
        }
        case Token.OpenBracket:
        case Token.CloseBracket: {
          contents =
            'Character set.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/character-classes/)'
          break
        }
        case Token.OpenBrace:
        case Token.CloseBrace: {
          contents =
            'Repetition.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/repetitions/)'
          break
        }
        case Token.Star: {
          contents =
            'Repeat last expression zero times or more.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/repetitions/)'
          break
        }
        case Token.Plus: {
          contents =
            'Repeat last expression once or more.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/repetitions/)'
          break
        }
        case Token.QuestionMark: {
          contents =
            'Make last expression optional.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/repetitions/)'
          break
        }
        case Token.CodePoint:
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
        if (/^[0-9a-fA-F]$/u.test(hexString)) {
          const codePoint = Number.parseInt(hexString, 16)
          const hex = codePoint.toString(16).toUpperCase().padStart(4, '0')
          const display = String.fromCodePoint(codePoint)

          const isVisible = !/[\p{Other}\p{Separator}]/u.test(display)
          const heading = isVisible ? `## ${display}\n` : ''
          contents = `${heading}Code point \`U+${hex}\` (dec: ${codePoint})`
        }
      } else if (tokenKind === Token.Identifier) {
        contents = identToTooltip(content)
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
    case 'let': {
      return `Declares a [variable](https://pomsky-lang.org/docs/language-tour/variables/).
Syntax:
~~~pomsky
let name = "expression";
name
~~~`
    }
    case 'range': {
      return `A [number range](https://pomsky-lang.org/docs/language-tour/ranges/),
which can match multi-digit numbers of any base. Syntax:
~~~pomsky
# match decimal numbers between 0 and 255
range '0'-'255'

# match hexadecimal numbers between 15 and FFF
range '15'-'FFF' base 16
~~~`
    }
    case 'atomic': {
      return `An [atomic group](https://pomsky-lang.org/docs/language-tour/groups/#atomic-groups).
Syntax:
~~~pomsky
atomic('group content')
~~~`
    }
    case 'regex': {
      return `An [inline regular expression](https://pomsky-lang.org/docs/language-tour/regex/).
Syntax:
~~~pomsky
regex '...'
~~~`
    }
    case 'lazy': {
      return `Makes the previous repetition [lazy](https://pomsky-lang.org/docs/language-tour/repetitions/#greedy-and-lazy-matching),
so it will match as few times as possible.
Syntax:
~~~pomsky
'...'* lazy
~~~`
    }
    case 'greedy': {
      return `Makes the previous repetition [greedy](https://pomsky-lang.org/docs/language-tour/repetitions/#greedy-and-lazy-matching),
so it will match as many times as possible. Note that lazy repetition is the default, so the \`greedy\`
modifier is only needed in [lazy mode](https://pomsky-lang.org/docs/language-tour/repetitions/).
Syntax:
~~~pomsky
'...'* lazy
~~~`
    }
    case 'U':
    case 'if':
    case 'else':
    case 'recursion':
    case 'test': {
      return `This keyword is reserved and can't be used as a variable name!`
    }
    case 'Start': {
      return `Start of string assertion; alias for \`^\`.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/boundaries/)`
    }
    case 'End': {
      return `End of string assertion; alias for \`$\`.\n\n[Documentation](https://pomsky-lang.org/docs/language-tour/boundaries/)`
    }
    case 'C':
    case 'Codepoint': {
      return `An arbitrary codepoint. Can be written as \`Codepoint\` or abbreviated as \`C\`.`
    }
    case 'G':
    case 'Grapheme': {
      return `An arbitrary [grapheme](https://pomsky-lang.org/docs/language-tour/graphemes/),
which may consist of multiple codepoints. Can be written as \`Grapheme\` or abbreviated as \`G\`.`
    }
    default:
      return
  }
}

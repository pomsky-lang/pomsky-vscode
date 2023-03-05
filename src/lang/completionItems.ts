import { CompletionItem, CompletionItemKind, CompletionItemProvider, Range } from 'vscode'
import { findClosestTokenIndex, isInCharacterSet, tokenizePomsky } from './tokenizePomsky'
import { charSetSnippets, globalSnippets } from './snippets'

export const completionItems: CompletionItemProvider = {
  provideCompletionItems(model, position) {
    const value = model.getText()
    const tokens = tokenizePomsky(value)

    const offset = model.offsetAt(position)
    const tokenIndex = findClosestTokenIndex(tokens, offset)
    let isInCharClass = false

    if (tokenIndex < tokens.length) {
      // don't show completions within strings or multi-char sigils such as `<<`
      const token = tokens[tokenIndex]
      if (token[0] !== 'Identifier' && offset > token[1] && offset < token[2]) return

      isInCharClass = isInCharacterSet(tokens, tokenIndex, offset)
    }

    const wordRange = model.getWordRangeAtPosition(position)

    const range = wordRange ?? new Range(position, position)

    const suggestions = isInCharClass
      ? charSetSnippets.map(snippet => ({ ...snippet, range } as CompletionItem))
      : [
          ...[...new Set([...value.matchAll(/\blet (\w+)/giu)].map(x => x[1]))].map(
            (word): CompletionItem =>
              ({
                kind: CompletionItemKind.Variable,
                label: word,
                insertText: word,
                detail: 'variable',
                range,
              } as CompletionItem),
          ),
          ...globalSnippets.map(snippet => ({ ...snippet, range } as CompletionItem)),
        ]

    return suggestions
  },
}

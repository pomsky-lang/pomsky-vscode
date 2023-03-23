import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Range,
  TextDocumentPositionParams,
  TextDocuments,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { charSetCompletions, globalCompletions, lookupDocumentation } from './snippets'
import { findClosestTokenIndex, isInCharacterSet, Token, tokenizePomsky } from './tokenizePomsky'
import { connection } from '../state'

export function initCompletion(documents: TextDocuments<TextDocument>) {
  // Provides the initial list of the completion items
  connection.onCompletion(
    ({ position, textDocument }: TextDocumentPositionParams): CompletionItem[] => {
      const model = documents.get(textDocument.uri)
      if (model === undefined) {
        return []
      }

      const text = model.getText()
      const tokens = tokenizePomsky(text)

      const offset = model.offsetAt(position)
      const tokenIndex = findClosestTokenIndex(tokens, offset)
      let isInCharClass = false

      if (tokenIndex < tokens.length) {
        // don't show completions within strings or multi-char sigils such as `<<`
        const token = tokens[tokenIndex]
        if (token[0] !== Token.Identifier && offset > token[1] && offset < token[2]) {
          return []
        }

        isInCharClass = isInCharacterSet(tokens, tokenIndex, offset)
      }

      const [_, wordStart, wordEnd] = tokens[tokenIndex]
      const range: Range =
        wordStart <= offset && offset <= wordEnd
          ? offsetToRange(model, wordStart, wordEnd)
          : offsetToRange(model, offset)

      const completions = isInCharClass
        ? charSetCompletions
        : [
            ...[...new Set([...text.matchAll(/\blet (\w+)/giu)].map(x => x[1]))].map(
              v =>
                ({
                  label: v,
                  detail: 'variable',
                  kind: CompletionItemKind.Variable,
                } satisfies CompletionItem as CompletionItem),
            ),
            ...globalCompletions,
          ]

      return completions.map(c => {
        if (c.insertText && c.insertTextFormat !== InsertTextFormat.Snippet) {
          c.textEdit = { range, newText: c.insertText }
          delete c.insertText
        }

        return c
      })
    },
  )

  // Resolves additional information for the item selected in the completion list
  connection.onCompletionResolve((item: CompletionItem) => {
    item.documentation ??= lookupDocumentation(item.detail, item.label)
    return item
  })
}

function offsetToRange(model: TextDocument, startOffset: number, endOffset = startOffset): Range {
  const start = model.positionAt(startOffset)
  const end = startOffset === endOffset ? start : model.positionAt(endOffset)

  return { start, end }
}

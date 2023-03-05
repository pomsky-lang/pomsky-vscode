import { ExtensionContext, languages } from 'vscode'
import { activateDiagnostics } from './lang/diagnostics'
import { completionItems } from './lang/completionItems'
import { activatePanel } from './previewPanel'

export function activate(context: ExtensionContext) {
  activatePanel(context)

  languages.registerCompletionItemProvider('pomsky', completionItems)

  activateDiagnostics(context)
}

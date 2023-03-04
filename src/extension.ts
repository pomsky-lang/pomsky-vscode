import { ExtensionContext } from 'vscode'
import { activatePanel } from './previewPanel'

export function activate(context: ExtensionContext) {
  activatePanel(context)
}

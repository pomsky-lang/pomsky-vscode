import * as path from 'node:path'
import { workspace, ExtensionContext } from 'vscode'

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { activatePanel } from './previewPanel'

let client: LanguageClient

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'))

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  }

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'pomsky' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
    },
  }

  client = new LanguageClient('pomsky', 'Pomksy', serverOptions, clientOptions)

  activatePanel(context, client)

  // Start the client. This will also launch the server
  client.start()
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}

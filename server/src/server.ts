import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { documentSettings, getDocumentSettings, initConfig } from './config'
import { capabilities, connection, setCapabilities, setConnection } from './state'
import { initCompletion } from './lang/completion'
import { initDiagnostics, validateTextDocument } from './lang/diagnostics'
import { pomskyVersion, runPomskyWithErrorHandler } from './lang/pomskyCli'
import { CompileHandler, CompileResultHandler } from './types/compileHandler'

setConnection(createConnection(ProposedFeatures.all))

const documents = new TextDocuments(TextDocument)

initConfig(documents, validateTextDocument)
initDiagnostics(documents)
initCompletion(documents)

console.log('Pomsky language server started.')

connection.onInitialize((params: InitializeParams) => {
  const { workspace, textDocument } = params.capabilities

  setCapabilities({
    config: workspace?.configuration ?? false,
    workspaceFolders: workspace?.workspaceFolders ?? false,
    diagnosticRelatedInformation: textDocument?.publishDiagnostics?.relatedInformation ?? false,
  })

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: { resolveProvider: true },
    },
  }
  if (capabilities.workspaceFolders) {
    result.capabilities.workspace = {
      workspaceFolders: { supported: true },
    }
  }
  return result
})

connection.onInitialized(() => {
  if (capabilities.config) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }
})

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri)
})

connection.onRequest('handler/compile', async ({ uri, content }: CompileHandler) => {
  const settings = await getDocumentSettings(uri)
  const res = await runPomskyWithErrorHandler(connection, { uri, getText: () => content }, settings)
  if (res === undefined) {
    connection.sendNotification('handler/compileResult', 'error')
    return
  }
  const versionInfo = await pomskyVersion(settings)

  connection.sendNotification('handler/compileResult', {
    ...res,
    flavor: settings.defaultFlavor,
    uri,
    versionInfo,
  } satisfies CompileResultHandler)
})

documents.listen(connection)
connection.listen()

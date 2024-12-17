import { Connection } from 'vscode-languageserver'
import { parse, ParseError, type Token, tokenize } from '@pomsky-lang/parser'
import type { Rule } from '@pomsky-lang/parser/rule'

interface Capabilities {
  readonly config: boolean
  readonly workspaceFolders: boolean
  readonly diagnosticRelatedInformation: boolean
}

export let capabilities: Capabilities = {
  config: false,
  workspaceFolders: false,
  diagnosticRelatedInformation: false,
}

export function setCapabilities(capabilities_: Capabilities) {
  capabilities = capabilities_
}

export let connection: Connection

export function setConnection(connection_: Connection) {
  connection = connection_
}

const documentInfo: Record<string, DocumentInfo> = {}

export interface DocumentInfo {
  lastContent: string
  tokens: [Token, number, number][]
  parsed?: Rule | ParseError[]
}

export interface DocumentInfoComplete extends DocumentInfo {
  parsed: Rule | ParseError[]
}

export function getInfo(uri: string, content: string, required: 'all'): DocumentInfoComplete
export function getInfo(uri: string, content: string, required: 'tokens'): DocumentInfo

export function getInfo(uri: string, content: string, required: 'tokens' | 'all'): DocumentInfo {
  let info = documentInfo[uri] as DocumentInfo | undefined
  if (info?.lastContent !== content) {
    info = { lastContent: content, tokens: tokenize(content) }
  }

  if (required === 'all' && !info.parsed) {
    info.parsed = parse(content, info.tokens)
  }
  documentInfo[uri] = info
  return info
}

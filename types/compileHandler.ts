import { Flavor } from './config'
import { PomskyJsonResponse } from './pomskyCli'

export interface CompileHandler {
  uri: string
  content: string
}

export interface CompileResultHandler extends PomskyJsonResponse {
  uri: string
  flavor: Flavor
  versionInfo: string
}

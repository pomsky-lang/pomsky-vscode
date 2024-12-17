export interface PomskyJsonResponse {
  version: '1'
  success: boolean
  output?: string
  diagnostics: PomskyJsonDiagnostic[]
  timings: { all: number }
}

export interface PomskyJsonDiagnostic {
  severity: 'error' | 'warning'
  kind: string
  code: string
  spans: PomskyJsonSpan[]
  description: string
  help: string[]
  fixes: never[]
  visual: string
}

export interface PomskyJsonSpan {
  start: number
  end: number
}

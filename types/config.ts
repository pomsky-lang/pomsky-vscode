export type Flavor = 'JavaScript' | 'DotNet' | 'Java' | 'Rust' | 'Python' | 'PCRE' | 'Rust' | 'Ruby'

export interface Config {
  defaultFlavor: Flavor
  runTests: boolean
  executable: {
    path: string
    extraArgs: string
    appearsValid?: boolean
    errorMsg?: string
  }
}

export type Flavor = 'JavaScript' | 'DotNet' | 'Java' | 'Rust' | 'Python' | 'PCRE' | 'Rust' | 'Ruby'

export interface Config {
  defaultFlavor: Flavor
  runTests?: 'pcre2' | 'rust'
  executable: {
    path: string
    extraArgs: string
    appearsValid?: boolean
    errorMsg?: string
  }
}

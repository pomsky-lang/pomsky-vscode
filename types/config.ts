export type Flavor = 'JavaScript' | 'DotNet' | 'Java' | 'Rust' | 'Python' | 'PCRE' | 'Rust' | 'Ruby'

export interface Config {
  defaultFlavor: Flavor
  executable: {
    path: string
    extraArgs: string
  }
}

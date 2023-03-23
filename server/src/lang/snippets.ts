import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from 'vscode-languageserver'

export const globalCompletions: CompletionItem[] = []
export const charSetCompletions: CompletionItem[] = []

export type Detail =
  | 'built-in'
  | 'snippet'
  | 'keyword'
  | 'character'
  | 'char-class'
  | 'general-category'
  | 'script'
  | 'block'
  | 'property'

const enum CompletionContext {
  Expr = 0,
  CharClass = 1,
  Stmt = 2,
  Mode = 3,
}

type Documentation = CompletionItem['documentation']
const documentationCache: Partial<Record<Detail, Record<string, Documentation>>> = {}

export function lookupDocumentation(detail: string | undefined, label: string) {
  return documentationCache[detail as Detail]?.[label]
}

function addCompletions(
  context: CompletionContext,
  detail: Detail,
  kind: CompletionItemKind,
  record: Record<string, string | { snippet: string; doc: string } | [string]>,
) {
  const cache = documentationCache[detail] ?? (documentationCache[detail] = {})
  const items = context === CompletionContext.CharClass ? charSetCompletions : globalCompletions

  for (const key in record) {
    let value = record[key]
    while (value instanceof Array) {
      value = record[value[0]]
    }

    if (typeof value === 'string') {
      items.push({ label: key, detail, kind })
      cache[key] = { kind: MarkupKind.Markdown, value }
    } else {
      items.push({
        label: key,
        detail,
        insertText: value.snippet,
        insertTextFormat: InsertTextFormat.Snippet,
      })
      cache[key] = { kind: MarkupKind.Markdown, value: value.doc }
    }
  }
}

function addGeneratedCompletions(
  context: CompletionContext,
  detail: Detail,
  kind: CompletionItemKind,
  docFunction: (label: string) => string,
  aliasFunction: (canonical: string, alias: string) => string,
  labels: string[][],
) {
  const cache = documentationCache[detail] ?? (documentationCache[detail] = {})
  const items = context === CompletionContext.CharClass ? charSetCompletions : globalCompletions

  for (const label of labels) {
    const canonical = label[0]

    items.push({ label: canonical, detail, kind })
    cache[canonical] = { kind: MarkupKind.Markdown, value: docFunction(canonical) }

    for (let i = 1; i < label.length; i++) {
      const alias = label[i]

      items.push({ label: alias, detail, kind })
      cache[alias] = { kind: MarkupKind.Markdown, value: aliasFunction(canonical, alias) }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                      predefined snippets                                       //
////////////////////////////////////////////////////////////////////////////////////////////////////

addCompletions(CompletionContext.Expr, 'built-in', CompletionItemKind.Value, {
  Start: 'Start of the string. Equivalent to `^`.',
  End: 'End of the string. Equivalent to `$`.',
  Codepoint: 'A single code point.',
  Grapheme: 'A single grapheme cluster.',
  C: ['Codepoint'],
  G: ['Grapheme'],
})

addCompletions(CompletionContext.Expr, 'snippet', CompletionItemKind.Value, {
  range: {
    snippet: "range '${1:0}'-'${2:255}'",
    doc: `Matches a range of numbers. Use this if the number may be more than 1 code point.

### Examples:
~~~pomsky
range '0'-'255'
range '0'-'10FFFF' base 16
~~~

[Reference](https://pomsky-lang.org/docs/language-tour/ranges/)`,
  },
  // TODO: Show only after range
  base: {
    snippet: 'base ${0:16}',
    doc: `Comes after a \`range\` expression to set the number base, e.g. 16 for hexadecimal.

### Example:
~~~pomsky
range '0'-'FFF' base 16
~~~`,
  },
  atomic: {
    snippet: 'atomic($0)',
    doc: `A special group that when exited discards all backtracking positions inside it.
This can improve performance by preventing exponential backtracking in some situations.

### Example:
~~~pomsky
atomic('bc' | 'b') 'c'
~~~

[Reference](https://www.regular-expressions.info/atomic.html)`,
  },
  regex: {
    snippet: "regex '${0:(?0)}'",
    doc: `Inline regular expressions are embedded in the output unchanged.
They're useful when you want to use a regex feature that isn't supported by Pomsky yet.

This should only be used as a last resort, since Pomsky can't ensure that the output is correct.

### Example:
~~~pomsky
# recursion, works in PCRE and Ruby
let recurse = regex '\\g<0>';
~~~

[Reference](https://pomsky-lang.org/docs/language-tour/regex/)`,
  },
})

addCompletions(CompletionContext.Stmt, 'snippet', CompletionItemKind.Value, {
  // TODO: Don't show after expression
  let: {
    snippet: 'let ${1:var_name} = $0;\n',
    doc: `Declares a variable.

### Example
~~~pomsky
let greeting = 'Hello';
greeting ' world'
~~~`,
  },
})

addCompletions(CompletionContext.Stmt, 'keyword', CompletionItemKind.Keyword, {
  enable: `Enables a mode, e.g. \`enable lazy;\`. Modes that can be enabled are
- \`unicode\` (enabled by default)
- \`lazy\` (disabled by default)`,
  disable: `Disables a mode, e.g. \`disable unicode;\`. Modes that can be disabled are
- \`unicode\` (enabled by default)
- \`lazy\` (disabled by default)`,
})

addCompletions(CompletionContext.Expr, 'keyword', CompletionItemKind.Keyword, {
  // TODO: only show after repetition or `enable`/`disable`
  lazy: `Keyword to make the previous repetition lazy. Opposite of \`greedy\`.

### Example:
~~~pomsky
['test']? lazy
~~~`,
  greedy: `Keyword to make the previous repetition greedy. Opposite of \`lazy\`.
Since \`greedy\` is the default, you only need this when you enabled \`lazy\` mode.

### Example:
~~~pomsky
enable lazy;
['test']? greedy
~~~`,
  // TODO: also show `unicode` after `enable`/`disable`
})

addCompletions(CompletionContext.CharClass, 'snippet', CompletionItemKind.Snippet, {
  range: {
    snippet: "'${1:A}'-'${2:Z}'",
    doc: `Matches a code point in the given range.

### Example:
~~~pomsky
['0'-'7']
~~~`,
  },
})

addCompletions(CompletionContext.CharClass, 'character', CompletionItemKind.Text, {
  n: 'The _newline_ character `\\n`',
  r: 'The _carriage_ return character `\\n`',
  f: 'The _line feed_ character `\\f`',
  a: 'The _alert_ or _bell_ character `\\a`',
  e: 'The _escape_ character `\\e`',
})

addCompletions(CompletionContext.CharClass, 'char-class', CompletionItemKind.Constant, {
  word: 'The _word_ character class, matching letters, digits and the underscore.',
  digit: 'The _digit_ character class',
  space: 'The _space_ character class, matching all whitespace',
  horiz_space:
    'The _horiz_space_ character class, matching horizontal whitespace, which includes the tab and all characters in the “space separator” Unicode category.',
  vert_space:
    'The _vert_space_ character class, matching vertical whitespace, which includes all characters treated as line breaks in the Unicode standard.',
  w: ['word'],
  d: ['digit'],
  s: ['space'],
  h: ['horiz_space'],
  v: ['vert_space'],
  ascii: 'The _ascii_ character class, matching all code points between U+00 and U+7F.',
  ascii_alpha: 'The _ascii_alpha_ character class, matching all ASCII letters (a-z, A-Z).',
  ascii_alnum:
    'The _ascii_alnum_ character class, matching all ASCII letters and digits (a-z, A-Z, 0-9).',
  ascii_blank: 'The _ascii_blank_ character class, matching the ASCII space and tab.',
  ascii_cntrl:
    'The _ascii_cntrl_ character class, matching ASCII control characters (U+00-U+1F, U+7F).',
  ascii_digit: 'The _ascii_digit_ character class, matching all ASCII digits (0-9).',
  ascii_graph:
    'The _ascii_graph_ character class, matching all visible ASCII characters, which includes all printable ASCII characters except for the space (U+21-U+7E).',
  ascii_lower: 'The _ascii_lower_ character class, matching all lowercase ASCII characters (a-z).',
  ascii_print:
    'The _ascii_print_ character class, matching all printable ASCII characters (U+20-U+7E).',
  ascii_punct:
    'The _ascii_punct_ character class, matching all ASCII punctuation and symbols (``!"#$%&\'()*+,-./:;<=>?@[\\]^_‘{|}~``).',
  ascii_space:
    'The _ascii_space_ character class, matching all ASCII whitespace characters (` \\t\\r\\n\\v\\f`).',
  ascii_upper: 'The _ascii_upper_ character class, matching all uppercase ASCII characters (A-Z).',
  ascii_word:
    'The _ascii_word_ character class, matching all ASCII word characters: Letters, digits and underscores (a-z, A-Z, 0-9, _).',
  ascii_xdigit:
    'The _ascii_xdigit_ character class, matching all ASCII hexadecimal digits (a-f, A-F, 0-9).',
})

addGeneratedCompletions(
  CompletionContext.CharClass,
  'general-category',
  CompletionItemKind.Constant,
  label => `The '${label}' general category`,
  (canonical, _alias) => `Alias for the '${canonical}' general category`,
  [
    ['Cased_Letter', 'LC'],
    ['Close_Punctuation', 'Pe'],
    ['Connector_Punctuation', 'Pc'],
    ['Control', 'Cc', 'cntrl'],
    ['Currency_Symbol', 'Sc'],
    ['Dash_Punctuation', 'Pd'],
    ['Decimal_Number', 'Nd'],
    ['Enclosing_Mark', 'Me'],
    ['Final_Punctuation', 'Pf'],
    ['Format', 'Cf'],
    ['Initial_Punctuation', 'Pi'],
    ['Letter', 'L'],
    ['Letter_Number', 'Nl'],
    ['Line_Separator', 'Zl'],
    ['Lowercase_Letter', 'Ll'],
    ['Mark', 'M', 'Combining_Mark'],
    ['Math_Symbol', 'Sm'],
    ['Modifier_Letter', 'Lm'],
    ['Modifier_Symbol', 'Sk'],
    ['Nonspacing_Mark', 'Mn'],
    ['Number', 'N'],
    ['Open_Punctuation', 'Ps'],
    ['Other', 'C'],
    ['Other_Letter', 'Lo'],
    ['Other_Number', 'No'],
    ['Other_Punctuation', 'Po'],
    ['Other_Symbol', 'So'],
    ['Paragraph_Separator', 'Zp'],
    ['Private_Use', 'Co'],
    ['Punctuation', 'P', 'punct'],
    ['Separator', 'Z'],
    ['Space_Separator', 'Zs'],
    ['Spacing_Mark', 'Mc'],
    ['Surrogate', 'Cs'],
    ['Symbol', 'S'],
    ['Titlecase_Letter', 'Lt'],
    ['Unassigned', 'Cn'],
    ['Uppercase_Letter', 'Lu'],
  ],
)

addGeneratedCompletions(
  CompletionContext.CharClass,
  'script',
  CompletionItemKind.Constant,
  label => `The '${label}' script`,
  (canonical, _alias) => `Alias for the '${canonical}' script`,
  [
    ['Adlam', 'Adlm'],
    ['Ahom'],
    ['Anatolian_Hieroglyphs', 'Hluw'],
    ['Arabic', 'Arab'],
    ['Armenian', 'Armn'],
    ['Avestan', 'Avst'],
    ['Balinese', 'Bali'],
    ['Bamum', 'Bamu'],
    ['Bassa_Vah', 'Bass'],
    ['Batak', 'Batk'],
    ['Bengali', 'Beng'],
    ['Bhaiksuki', 'Bhks'],
    ['Bopomofo', 'Bopo'],
    ['Brahmi', 'Brah'],
    ['Braille', 'Brai'],
    ['Buginese', 'Bugi'],
    ['Buhid', 'Buhd'],
    ['Canadian_Aboriginal', 'Cans'],
    ['Carian', 'Cari'],
    ['Caucasian_Albanian', 'Aghb'],
    ['Chakma', 'Cakm'],
    ['Cham'],
    ['Cherokee', 'Cher'],
    ['Chorasmian', 'Chrs'],
    ['Common', 'Zyyy'],
    ['Coptic', 'Copt', 'Qaac'],
    ['Cuneiform', 'Xsux'],
    ['Cypriot', 'Cprt'],
    ['Cypro_Minoan', 'Cpmn'],
    ['Cyrillic', 'Cyrl'],
    ['Deseret', 'Dsrt'],
    ['Devanagari', 'Deva'],
    ['Dives_Akuru', 'Diak'],
    ['Dogra', 'Dogr'],
    ['Duployan', 'Dupl'],
    ['Egyptian_Hieroglyphs', 'Egyp'],
    ['Elbasan', 'Elba'],
    ['Elymaic', 'Elym'],
    ['Ethiopic', 'Ethi'],
    ['Georgian', 'Geor'],
    ['Glagolitic', 'Glag'],
    ['Gothic', 'Goth'],
    ['Grantha', 'Gran'],
    ['Greek', 'Grek'],
    ['Gujarati', 'Gujr'],
    ['Gunjala_Gondi', 'Gong'],
    ['Gurmukhi', 'Guru'],
    ['Han', 'Hani'],
    ['Hangul', 'Hang'],
    ['Hanifi_Rohingya', 'Rohg'],
    ['Hanunoo', 'Hano'],
    ['Hatran', 'Hatr'],
    ['Hebrew', 'Hebr'],
    ['Hiragana', 'Hira'],
    ['Imperial_Aramaic', 'Armi'],
    ['Inherited', 'Zinh', 'Qaai'],
    ['Inscriptional_Pahlavi', 'Phli'],
    ['Inscriptional_Parthian', 'Prti'],
    ['Javanese', 'Java'],
    ['Kaithi', 'Kthi'],
    ['Kannada', 'Knda'],
    ['Katakana', 'Kana'],
    ['Kawi'],
    ['Kayah_Li', 'Kali'],
    ['Kharoshthi', 'Khar'],
    ['Khitan_Small_Script', 'Kits'],
    ['Khmer', 'Khmr'],
    ['Khojki', 'Khoj'],
    ['Khudawadi', 'Sind'],
    ['Lao', 'Laoo'],
    ['Latin', 'Latn'],
    ['Lepcha', 'Lepc'],
    ['Limbu', 'Limb'],
    ['Linear_A', 'Lina'],
    ['Linear_B', 'Linb'],
    ['Lisu'],
    ['Lycian', 'Lyci'],
    ['Lydian', 'Lydi'],
    ['Mahajani', 'Mahj'],
    ['Makasar', 'Maka'],
    ['Malayalam', 'Mlym'],
    ['Mandaic', 'Mand'],
    ['Manichaean', 'Mani'],
    ['Marchen', 'Marc'],
    ['Masaram_Gondi', 'Gonm'],
    ['Medefaidrin', 'Medf'],
    ['Meetei_Mayek', 'Mtei'],
    ['Mende_Kikakui', 'Mend'],
    ['Meroitic_Cursive', 'Merc'],
    ['Meroitic_Hieroglyphs', 'Mero'],
    ['Miao', 'Plrd'],
    ['Modi'],
    ['Mongolian', 'Mong'],
    ['Mro', 'Mroo'],
    ['Multani', 'Mult'],
    ['Myanmar', 'Mymr'],
    ['Nabataean', 'Nbat'],
    ['Nag_Mundari', 'Nagm'],
    ['Nandinagari', 'Nand'],
    ['New_Tai_Lue', 'Talu'],
    ['Newa'],
    ['Nko', 'Nkoo'],
    ['Nushu', 'Nshu'],
    ['Nyiakeng_Puachue_Hmong', 'Hmnp'],
    ['Ogham', 'Ogam'],
    ['Ol_Chiki', 'Olck'],
    ['Old_Hungarian', 'Hung'],
    ['Old_Italic', 'Ital'],
    ['Old_North_Arabian', 'Narb'],
    ['Old_Permic', 'Perm'],
    ['Old_Persian', 'Xpeo'],
    ['Old_Sogdian', 'Sogo'],
    ['Old_South_Arabian', 'Sarb'],
    ['Old_Turkic', 'Orkh'],
    ['Old_Uyghur', 'Ougr'],
    ['Oriya', 'Orya'],
    ['Osage', 'Osge'],
    ['Osmanya', 'Osma'],
    ['Pahawh_Hmong', 'Hmng'],
    ['Palmyrene', 'Palm'],
    ['Pau_Cin_Hau', 'Pauc'],
    ['Phags_Pa', 'Phag'],
    ['Phoenician', 'Phnx'],
    ['Psalter_Pahlavi', 'Phlp'],
    ['Rejang', 'Rjng'],
    ['Runic', 'Runr'],
    ['Samaritan', 'Samr'],
    ['Saurashtra', 'Saur'],
    ['Sharada', 'Shrd'],
    ['Shavian', 'Shaw'],
    ['Siddham', 'Sidd'],
    ['SignWriting', 'Sgnw'],
    ['Sinhala', 'Sinh'],
    ['Sogdian', 'Sogd'],
    ['Sora_Sompeng', 'Sora'],
    ['Soyombo', 'Soyo'],
    ['Sundanese', 'Sund'],
    ['Syloti_Nagri', 'Sylo'],
    ['Syriac', 'Syrc'],
    ['Tagalog', 'Tglg'],
    ['Tagbanwa', 'Tagb'],
    ['Tai_Le', 'Tale'],
    ['Tai_Tham', 'Lana'],
    ['Tai_Viet', 'Tavt'],
    ['Takri', 'Takr'],
    ['Tamil', 'Taml'],
    ['Tangsa', 'Tnsa'],
    ['Tangut', 'Tang'],
    ['Telugu', 'Telu'],
    ['Thaana', 'Thaa'],
    ['Thai'],
    ['Tibetan', 'Tibt'],
    ['Tifinagh', 'Tfng'],
    ['Tirhuta', 'Tirh'],
    ['Toto'],
    ['Ugaritic', 'Ugar'],
    ['Unknown', 'Zzzz'],
    ['Vai', 'Vaii'],
    ['Vithkuqi', 'Vith'],
    ['Wancho', 'Wcho'],
    ['Warang_Citi', 'Wara'],
    ['Yezidi', 'Yezi'],
    ['Yi', 'Yiii'],
    ['Zanabazar_Square', 'Zanb'],
  ],
)

addGeneratedCompletions(
  CompletionContext.CharClass,
  'block',
  CompletionItemKind.Constant,
  label => `The '${label}' Unicode block`,
  (canonical, _alias) => `Alias for the '${canonical}' Unicode block`,
  [
    ['InAdlam'],
    ['InAegean_Numbers'],
    ['InAhom'],
    ['InAlchemical_Symbols', 'InAlchemical'],
    ['InAlphabetic_Presentation_Forms', 'InAlphabetic_PF'],
    ['InAnatolian_Hieroglyphs'],
    ['InAncient_Greek_Musical_Notation', 'InAncient_Greek_Music'],
    ['InAncient_Greek_Numbers'],
    ['InAncient_Symbols'],
    ['InArabic'],
    ['InArabic_Extended_A', 'InArabic_Ext_A'],
    ['InArabic_Extended_B', 'InArabic_Ext_B'],
    ['InArabic_Extended_C', 'InArabic_Ext_C'],
    ['InArabic_Mathematical_Alphabetic_Symbols', 'InArabic_Math'],
    ['InArabic_Presentation_Forms_A', 'InArabic_PF_A', 'InArabic_Presentation_Forms_A'],
    ['InArabic_Presentation_Forms_B', 'InArabic_PF_B'],
    ['InArabic_Supplement', 'InArabic_Sup'],
    ['InArmenian'],
    ['InArrows'],
    ['InAvestan'],
    ['InBalinese'],
    ['InBamum'],
    ['InBamum_Supplement', 'InBamum_Sup'],
    ['InBasic_Latin', 'InASCII'],
    ['InBassa_Vah'],
    ['InBatak'],
    ['InBengali'],
    ['InBhaiksuki'],
    ['InBlock_Elements'],
    ['InBopomofo'],
    ['InBopomofo_Extended', 'InBopomofo_Ext'],
    ['InBox_Drawing'],
    ['InBrahmi'],
    ['InBraille_Patterns', 'InBraille'],
    ['InBuginese'],
    ['InBuhid'],
    ['InByzantine_Musical_Symbols', 'InByzantine_Music'],
    ['InCarian'],
    ['InCaucasian_Albanian'],
    ['InChakma'],
    ['InCham'],
    ['InCherokee'],
    ['InCherokee_Supplement', 'InCherokee_Sup'],
    ['InChess_Symbols'],
    ['InChorasmian'],
    ['InCJK_Compatibility', 'InCJK_Compat'],
    ['InCJK_Compatibility_Forms', 'InCJK_Compat_Forms'],
    ['InCJK_Compatibility_Ideographs', 'InCJK_Compat_Ideographs'],
    ['InCJK_Compatibility_Ideographs_Supplement', 'InCJK_Compat_Ideographs_Sup'],
    ['InCJK_Radicals_Supplement', 'InCJK_Radicals_Sup'],
    ['InCJK_Strokes'],
    ['InCJK_Symbols_And_Punctuation', 'InCJK_Symbols'],
    ['InCJK_Unified_Ideographs', 'InCJK'],
    ['InCJK_Unified_Ideographs_Extension_A', 'InCJK_Ext_A'],
    ['InCJK_Unified_Ideographs_Extension_B', 'InCJK_Ext_B'],
    ['InCJK_Unified_Ideographs_Extension_C', 'InCJK_Ext_C'],
    ['InCJK_Unified_Ideographs_Extension_D', 'InCJK_Ext_D'],
    ['InCJK_Unified_Ideographs_Extension_E', 'InCJK_Ext_E'],
    ['InCJK_Unified_Ideographs_Extension_F', 'InCJK_Ext_F'],
    ['InCJK_Unified_Ideographs_Extension_G', 'InCJK_Ext_G'],
    ['InCJK_Unified_Ideographs_Extension_H', 'InCJK_Ext_H'],
    ['InCombining_Diacritical_Marks', 'InDiacriticals'],
    ['InCombining_Diacritical_Marks_Extended', 'InDiacriticals_Ext'],
    [
      'InCombining_Diacritical_Marks_For_Symbols',
      'InDiacriticals_For_Symbols',
      'InCombining_Marks_For_Symbols',
    ],
    ['InCombining_Diacritical_Marks_Supplement', 'InDiacriticals_Sup'],
    ['InCombining_Half_Marks', 'InHalf_Marks'],
    ['InCommon_Indic_Number_Forms', 'InIndic_Number_Forms'],
    ['InControl_Pictures'],
    ['InCoptic'],
    ['InCoptic_Epact_Numbers'],
    ['InCounting_Rod_Numerals', 'InCounting_Rod'],
    ['InCuneiform'],
    ['InCuneiform_Numbers_And_Punctuation', 'InCuneiform_Numbers'],
    ['InCurrency_Symbols'],
    ['InCypriot_Syllabary'],
    ['InCypro_Minoan'],
    ['InCyrillic'],
    ['InCyrillic_Extended_A', 'InCyrillic_Ext_A'],
    ['InCyrillic_Extended_B', 'InCyrillic_Ext_B'],
    ['InCyrillic_Extended_C', 'InCyrillic_Ext_C'],
    ['InCyrillic_Extended_D', 'InCyrillic_Ext_D'],
    ['InCyrillic_Supplement', 'InCyrillic_Sup', 'InCyrillic_Supplementary'],
    ['InDeseret'],
    ['InDevanagari'],
    ['InDevanagari_Extended', 'InDevanagari_Ext'],
    ['InDevanagari_Extended_A', 'InDevanagari_Ext_A'],
    ['InDingbats'],
    ['InDives_Akuru'],
    ['InDogra'],
    ['InDomino_Tiles', 'InDomino'],
    ['InDuployan'],
    ['InEarly_Dynastic_Cuneiform'],
    ['InEgyptian_Hieroglyph_Format_Controls'],
    ['InEgyptian_Hieroglyphs'],
    ['InElbasan'],
    ['InElymaic'],
    ['InEmoticons'],
    ['InEnclosed_Alphanumeric_Supplement', 'InEnclosed_Alphanum_Sup'],
    ['InEnclosed_Alphanumerics', 'InEnclosed_Alphanum'],
    ['InEnclosed_CJK_Letters_And_Months', 'InEnclosed_CJK'],
    ['InEnclosed_Ideographic_Supplement', 'InEnclosed_Ideographic_Sup'],
    ['InEthiopic'],
    ['InEthiopic_Extended', 'InEthiopic_Ext'],
    ['InEthiopic_Extended_A', 'InEthiopic_Ext_A'],
    ['InEthiopic_Extended_B', 'InEthiopic_Ext_B'],
    ['InEthiopic_Supplement', 'InEthiopic_Sup'],
    ['InGeneral_Punctuation', 'InPunctuation'],
    ['InGeometric_Shapes'],
    ['InGeometric_Shapes_Extended', 'InGeometric_Shapes_Ext'],
    ['InGeorgian'],
    ['InGeorgian_Extended', 'InGeorgian_Ext'],
    ['InGeorgian_Supplement', 'InGeorgian_Sup'],
    ['InGlagolitic'],
    ['InGlagolitic_Supplement', 'InGlagolitic_Sup'],
    ['InGothic'],
    ['InGrantha'],
    ['InGreek_And_Coptic', 'InGreek'],
    ['InGreek_Extended', 'InGreek_Ext'],
    ['InGujarati'],
    ['InGunjala_Gondi'],
    ['InGurmukhi'],
    ['InHalfwidth_And_Fullwidth_Forms', 'InHalf_And_Full_Forms'],
    ['InHangul_Compatibility_Jamo', 'InCompat_Jamo'],
    ['InHangul_Jamo', 'InJamo'],
    ['InHangul_Jamo_Extended_A', 'InJamo_Ext_A'],
    ['InHangul_Jamo_Extended_B', 'InJamo_Ext_B'],
    ['InHangul_Syllables', 'InHangul'],
    ['InHanifi_Rohingya'],
    ['InHanunoo'],
    ['InHatran'],
    ['InHebrew'],
    ['InHigh_Private_Use_Surrogates', 'InHigh_PU_Surrogates'],
    ['InHigh_Surrogates'],
    ['InHiragana'],
    ['InIdeographic_Description_Characters', 'InIDC'],
    ['InIdeographic_Symbols_And_Punctuation', 'InIdeographic_Symbols'],
    ['InImperial_Aramaic'],
    ['InIndic_Siyaq_Numbers'],
    ['InInscriptional_Pahlavi'],
    ['InInscriptional_Parthian'],
    ['InIPA_Extensions', 'InIPA_Ext'],
    ['InJavanese'],
    ['InKaithi'],
    ['InKaktovik_Numerals'],
    ['InKana_Extended_A', 'InKana_Ext_A'],
    ['InKana_Extended_B', 'InKana_Ext_B'],
    ['InKana_Supplement', 'InKana_Sup'],
    ['InKanbun'],
    ['InKangxi_Radicals', 'InKangxi'],
    ['InKannada'],
    ['InKatakana'],
    ['InKatakana_Phonetic_Extensions', 'InKatakana_Ext'],
    ['InKawi'],
    ['InKayah_Li'],
    ['InKharoshthi'],
    ['InKhitan_Small_Script'],
    ['InKhmer'],
    ['InKhmer_Symbols'],
    ['InKhojki'],
    ['InKhudawadi'],
    ['InLao'],
    ['InLatin_1_Supplement', 'InLatin_1_Sup', 'InLatin_1'],
    ['InLatin_Extended_A', 'InLatin_Ext_A'],
    ['InLatin_Extended_Additional', 'InLatin_Ext_Additional'],
    ['InLatin_Extended_B', 'InLatin_Ext_B'],
    ['InLatin_Extended_C', 'InLatin_Ext_C'],
    ['InLatin_Extended_D', 'InLatin_Ext_D'],
    ['InLatin_Extended_E', 'InLatin_Ext_E'],
    ['InLatin_Extended_F', 'InLatin_Ext_F'],
    ['InLatin_Extended_G', 'InLatin_Ext_G'],
    ['InLepcha'],
    ['InLetterlike_Symbols'],
    ['InLimbu'],
    ['InLinear_A'],
    ['InLinear_B_Ideograms'],
    ['InLinear_B_Syllabary'],
    ['InLisu'],
    ['InLisu_Supplement', 'InLisu_Sup'],
    ['InLow_Surrogates'],
    ['InLycian'],
    ['InLydian'],
    ['InMahajani'],
    ['InMahjong_Tiles', 'InMahjong'],
    ['InMakasar'],
    ['InMalayalam'],
    ['InMandaic'],
    ['InManichaean'],
    ['InMarchen'],
    ['InMasaram_Gondi'],
    ['InMathematical_Alphanumeric_Symbols', 'InMath_Alphanum'],
    ['InMathematical_Operators', 'InMath_Operators'],
    ['InMayan_Numerals'],
    ['InMedefaidrin'],
    ['InMeetei_Mayek'],
    ['InMeetei_Mayek_Extensions', 'InMeetei_Mayek_Ext'],
    ['InMende_Kikakui'],
    ['InMeroitic_Cursive'],
    ['InMeroitic_Hieroglyphs'],
    ['InMiao'],
    ['InMiscellaneous_Mathematical_Symbols_A', 'InMisc_Math_Symbols_A'],
    ['InMiscellaneous_Mathematical_Symbols_B', 'InMisc_Math_Symbols_B'],
    ['InMiscellaneous_Symbols', 'InMisc_Symbols'],
    ['InMiscellaneous_Symbols_And_Arrows', 'InMisc_Arrows'],
    ['InMiscellaneous_Symbols_And_Pictographs', 'InMisc_Pictographs'],
    ['InMiscellaneous_Technical', 'InMisc_Technical'],
    ['InModi'],
    ['InModifier_Tone_Letters'],
    ['InMongolian'],
    ['InMongolian_Supplement', 'InMongolian_Sup'],
    ['InMro'],
    ['InMultani'],
    ['InMusical_Symbols', 'InMusic'],
    ['InMyanmar'],
    ['InMyanmar_Extended_A', 'InMyanmar_Ext_A'],
    ['InMyanmar_Extended_B', 'InMyanmar_Ext_B'],
    ['InNabataean'],
    ['InNag_Mundari'],
    ['InNandinagari'],
    ['InNew_Tai_Lue'],
    ['InNewa'],
    ['InNKo'],
    ['InNo_Block', 'InNB'],
    ['InNumber_Forms'],
    ['InNushu'],
    ['InNyiakeng_Puachue_Hmong'],
    ['InOgham'],
    ['InOl_Chiki'],
    ['InOld_Hungarian'],
    ['InOld_Italic'],
    ['InOld_North_Arabian'],
    ['InOld_Permic'],
    ['InOld_Persian'],
    ['InOld_Sogdian'],
    ['InOld_South_Arabian'],
    ['InOld_Turkic'],
    ['InOld_Uyghur'],
    ['InOptical_Character_Recognition', 'InOCR'],
    ['InOriya'],
    ['InOrnamental_Dingbats'],
    ['InOsage'],
    ['InOsmanya'],
    ['InOttoman_Siyaq_Numbers'],
    ['InPahawh_Hmong'],
    ['InPalmyrene'],
    ['InPau_Cin_Hau'],
    ['InPhags_Pa'],
    ['InPhaistos_Disc', 'InPhaistos'],
    ['InPhoenician'],
    ['InPhonetic_Extensions', 'InPhonetic_Ext'],
    ['InPhonetic_Extensions_Supplement', 'InPhonetic_Ext_Sup'],
    ['InPlaying_Cards'],
    ['InPrivate_Use_Area', 'InPUA', 'InPrivate_Use'],
    ['InPsalter_Pahlavi'],
    ['InRejang'],
    ['InRumi_Numeral_Symbols', 'InRumi'],
    ['InRunic'],
    ['InSamaritan'],
    ['InSaurashtra'],
    ['InSharada'],
    ['InShavian'],
    ['InShorthand_Format_Controls'],
    ['InSiddham'],
    ['InSinhala'],
    ['InSinhala_Archaic_Numbers'],
    ['InSmall_Form_Variants', 'InSmall_Forms'],
    ['InSmall_Kana_Extension', 'InSmall_Kana_Ext'],
    ['InSogdian'],
    ['InSora_Sompeng'],
    ['InSoyombo'],
    ['InSpacing_Modifier_Letters', 'InModifier_Letters'],
    ['InSpecials'],
    ['InSundanese'],
    ['InSundanese_Supplement', 'InSundanese_Sup'],
    ['InSuperscripts_And_Subscripts', 'InSuper_And_Sub'],
    ['InSupplemental_Arrows_A', 'InSup_Arrows_A'],
    ['InSupplemental_Arrows_B', 'InSup_Arrows_B'],
    ['InSupplemental_Arrows_C', 'InSup_Arrows_C'],
    ['InSupplemental_Mathematical_Operators', 'InSup_Math_Operators'],
    ['InSupplemental_Punctuation', 'InSup_Punctuation'],
    ['InSupplemental_Symbols_And_Pictographs', 'InSup_Symbols_And_Pictographs'],
    ['InSupplementary_Private_Use_Area_A', 'InSup_PUA_A'],
    ['InSupplementary_Private_Use_Area_B', 'InSup_PUA_B'],
    ['InSutton_SignWriting'],
    ['InSyloti_Nagri'],
    ['InSymbols_And_Pictographs_Extended_A', 'InSymbols_And_Pictographs_Ext_A'],
    ['InSymbols_For_Legacy_Computing'],
    ['InSyriac'],
    ['InSyriac_Supplement', 'InSyriac_Sup'],
    ['InTagalog'],
    ['InTagbanwa'],
    ['InTags'],
    ['InTai_Le'],
    ['InTai_Tham'],
    ['InTai_Viet'],
    ['InTai_Xuan_Jing_Symbols', 'InTai_Xuan_Jing'],
    ['InTakri'],
    ['InTamil'],
    ['InTamil_Supplement', 'InTamil_Sup'],
    ['InTangsa'],
    ['InTangut'],
    ['InTangut_Components'],
    ['InTangut_Supplement', 'InTangut_Sup'],
    ['InTelugu'],
    ['InThaana'],
    ['InThai'],
    ['InTibetan'],
    ['InTifinagh'],
    ['InTirhuta'],
    ['InToto'],
    ['InTransport_And_Map_Symbols', 'InTransport_And_Map'],
    ['InUgaritic'],
    ['InUnified_Canadian_Aboriginal_Syllabics', 'InUCAS', 'InCanadian_Syllabics'],
    ['InUnified_Canadian_Aboriginal_Syllabics_Extended', 'InUCAS_Ext'],
    ['InUnified_Canadian_Aboriginal_Syllabics_Extended_A', 'InUCAS_Ext_A'],
    ['InVai'],
    ['InVariation_Selectors', 'InVS'],
    ['InVariation_Selectors_Supplement', 'InVS_Sup'],
    ['InVedic_Extensions', 'InVedic_Ext'],
    ['InVertical_Forms'],
    ['InVithkuqi'],
    ['InWancho'],
    ['InWarang_Citi'],
    ['InYezidi'],
    ['InYi_Radicals'],
    ['InYi_Syllables'],
    ['InYijing_Hexagram_Symbols', 'InYijing'],
    ['InZanabazar_Square'],
    ['InZnamenny_Musical_Notation', 'InZnamenny_Music'],
  ],
)

addGeneratedCompletions(
  CompletionContext.CharClass,
  'property',
  CompletionItemKind.Constant,
  label => `The '${label}' Unicode property`,
  (canonical, _alias) => `Alias for the '${canonical}' Unicode property`,
  [
    ['Alphabetic', 'Alpha'],
    ['Any'],
    ['ASCII'],
    ['ASCII_Hex_Digit', 'AHex'],
    ['Assigned'],
    ['Bidi_Control', 'Bidi_C'],
    ['Bidi_Mirrored', 'Bidi_M'],
    ['Case_Ignorable', 'CI'],
    ['Cased'],
    ['Changes_When_Casefolded', 'CWCF'],
    ['Changes_When_Casemapped', 'CWCM'],
    ['Changes_When_Lowercased', 'CWL'],
    ['Changes_When_NFKC_Casefolded', 'CWKCF'],
    ['Changes_When_Titlecased', 'CWT'],
    ['Changes_When_Uppercased', 'CWU'],
    ['Dash'],
    ['Default_Ignorable_Code_Point', 'DI'],
    ['Deprecated', 'Dep'],
    ['Diacritic', 'Dia'],
    ['Emoji'],
    ['Emoji_Component', 'EComp'],
    ['Emoji_Modifier', 'EMod'],
    ['Emoji_Modifier_Base', 'EBase'],
    ['Emoji_Presentation', 'EPres'],
    ['Extended_Pictographic', 'ExtPict'],
    ['Extender', 'Ext'],
    ['Grapheme_Base', 'Gr_Base'],
    ['Grapheme_Extend', 'Gr_Ext'],
    ['Hex_Digit', 'Hex'],
    ['ID_Continue', 'IDC'],
    ['ID_Start', 'IDS'],
    ['Ideographic', 'Ideo'],
    ['IDS_Binary_Operator', 'IDSB'],
    ['IDS_Trinary_Operator', 'IDST'],
    ['Join_Control', 'Join_C'],
    ['Logical_Order_Exception', 'LOE'],
    ['Lowercase', 'Lower'],
    ['Math'],
    ['Noncharacter_Code_Point', 'NChar'],
    ['Pattern_Syntax', 'Pat_Syn'],
    ['Pattern_White_Space', 'Pat_WS'],
    ['Quotation_Mark', 'QMark'],
    ['Radical'],
    ['Regional_Indicator', 'RI'],
    ['Sentence_Terminal', 'STerm'],
    ['Soft_Dotted', 'SD'],
    ['Terminal_Punctuation', 'Term'],
    ['Unified_Ideograph', 'UIdeo'],
    ['Uppercase', 'Upper'],
    ['Variation_Selector', 'VS'],
    ['White_Space', 'space'],
    ['XID_Continue', 'XIDC'],
    ['XID_Start', 'XIDS'],
  ],
)

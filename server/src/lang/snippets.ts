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
    ['Chorasmian', 'Chrs'],
    ['Cherokee', 'Cher'],
    ['Common', 'Zyyy'],
    ['Coptic', 'Copt'],
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
    ['Inherited', 'Zinh'],
    ['Inscriptional_Pahlavi', 'Phli'],
    ['Inscriptional_Parthian', 'Prti'],
    ['Javanese', 'Java'],
    ['Kaithi', 'Kthi'],
    ['Kannada', 'Knda'],
    ['Katakana', 'Kana'],
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
    ['Medefaidrin', 'Medf'],
    ['Masaram_Gondi', 'Gonm'],
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
    ['InBasic_Latin'],
    ['InLatin_1_Supplement'],
    ['InLatin_Extended_A'],
    ['InLatin_Extended_B'],
    ['InIPA_Extensions'],
    ['InSpacing_Modifier_Letters'],
    ['InCombining_Diacritical_Marks'],
    ['InGreek_and_Coptic'],
    ['InCyrillic'],
    ['InCyrillic_Supplementary'],
    ['InArmenian'],
    ['InHebrew'],
    ['InArabic'],
    ['InSyriac'],
    ['InThaana'],
    ['InDevanagari'],
    ['InBengali'],
    ['InGurmukhi'],
    ['InGujarati'],
    ['InOriya'],
    ['InTamil'],
    ['InTelugu'],
    ['InKannada'],
    ['InMalayalam'],
    ['InSinhala'],
    ['InThai'],
    ['InLao'],
    ['InTibetan'],
    ['InMyanmar'],
    ['InGeorgian'],
    ['InHangul_Jamo'],
    ['InEthiopic'],
    ['InCherokee'],
    ['InUnified_Canadian_Aboriginal_Syllabics'],
    ['InOgham'],
    ['InRunic'],
    ['InTagalog'],
    ['InHanunoo'],
    ['InBuhid'],
    ['InTagbanwa'],
    ['InKhmer'],
    ['InMongolian'],
    ['InLimbu'],
    ['InTai_Le'],
    ['InKhmer_Symbols'],
    ['InPhonetic_Extensions'],
    ['InLatin_Extended_Additional'],
    ['InGreek_Extended'],
    ['InGeneral_Punctuation'],
    ['InSuperscripts_and_Subscripts'],
    ['InCurrency_Symbols'],
    ['InCombining_Diacritical_Marks_for_Symbols'],
    ['InLetterlike_Symbols'],
    ['InNumber_Forms'],
    ['InArrows'],
    ['InMathematical_Operators'],
    ['InMiscellaneous_Technical'],
    ['InControl_Pictures'],
    ['InOptical_Character_Recognition'],
    ['InEnclosed_Alphanumerics'],
    ['InBox_Drawing'],
    ['InBlock_Elements'],
    ['InGeometric_Shapes'],
    ['InMiscellaneous_Symbols'],
    ['InDingbats'],
    ['InMiscellaneous_Mathematical_Symbols_A'],
    ['InSupplemental_Arrows_A'],
    ['InBraille_Patterns'],
    ['InSupplemental_Arrows_B'],
    ['InMiscellaneous_Mathematical_Symbols_B'],
    ['InSupplemental_Mathematical_Operators'],
    ['InMiscellaneous_Symbols_and_Arrows'],
    ['InCJK_Radicals_Supplement'],
    ['InKangxi_Radicals'],
    ['InIdeographic_Description_Characters'],
    ['InCJK_Symbols_and_Punctuation'],
    ['InHiragana'],
    ['InKatakana'],
    ['InBopomofo'],
    ['InHangul_Compatibility_Jamo'],
    ['InKanbun'],
    ['InBopomofo_Extended'],
    ['InKatakana_Phonetic_Extensions'],
    ['InEnclosed_CJK_Letters_and_Months'],
    ['InCJK_Compatibility'],
    ['InCJK_Unified_Ideographs_Extension_A'],
    ['InYijing_Hexagram_Symbols'],
    ['InCJK_Unified_Ideographs'],
    ['InYi_Syllables'],
    ['InYi_Radicals'],
    ['InHangul_Syllables'],
    ['InHigh_Surrogates'],
    ['InHigh_Private_Use_Surrogates'],
    ['InLow_Surrogates'],
    ['InPrivate_Use_Area'],
    ['InCJK_Compatibility_Ideographs'],
    ['InAlphabetic_Presentation_Forms'],
    ['InArabic_Presentation_Forms_A'],
    ['InVariation_Selectors'],
    ['InCombining_Half_Marks'],
    ['InCJK_Compatibility_Forms'],
    ['InSmall_Form_Variants'],
    ['InArabic_Presentation_Forms_B'],
    ['InHalfwidth_and_Fullwidth_Forms'],
    ['InSpecials'],
  ],
)

addGeneratedCompletions(
  CompletionContext.CharClass,
  'property',
  CompletionItemKind.Constant,
  label => `The '${label}' Unicode property`,
  (canonical, _alias) => `Alias for the '${canonical}' Unicode property`,
  [
    ['White_Space'],
    ['Alphabetic, Alpha'],
    ['Noncharacter_Code_Point'],
    ['Default_Ignorable_Code_Point'],
    ['Logical_Order_Exception'],
    ['Deprecated'],
    ['Variation_Selector'],
    ['Uppercase, upper'],
    ['Lowercase, lower'],
    ['Soft_Dotted'],
    ['Case_Ignorable'],
    ['Changes_When_Lowercased'],
    ['Changes_When_Uppercased'],
    ['Changes_When_Titlecased'],
    ['Changes_When_Casefolded'],
    ['Changes_When_Casemapped'],
    ['Emoji'],
    ['Emoji_Presentation'],
    ['Emoji_Modifier'],
    ['Emoji_Modifier_Base'],
    ['Emoji_Component'],
    ['Extended_Pictographic'],
    ['Hex_Digit'],
    ['ASCII_Hex_Digit'],
    ['Join_Control'],
    ['Joining_Group'],
    ['Bidi_Control'],
    ['Bidi_Mirrored'],
    ['Bidi_Mirroring_Glyph'],
    ['ID_Continue'],
    ['ID_Start'],
    ['XID_Continue'],
    ['XID_Start'],
    ['Pattern_Syntax'],
    ['Pattern_White_Space'],
    ['Ideographic'],
    ['Unified_Ideograph'],
    ['Radical'],
    ['IDS_Binary_Operator'],
    ['IDS_Trinary_Operator'],
    ['Math'],
    ['Quotation_Mark'],
    ['Dash'],
    ['Sentence_Terminal'],
    ['Terminal_Punctuation'],
    ['Diacritic'],
    ['Extender'],
    ['Grapheme_Base'],
    ['Grapheme_Extend'],
    ['Regional_Indicator'],
  ],
)

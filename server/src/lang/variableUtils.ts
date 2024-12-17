import { RuleKind, StmtKind, StmtExpr } from '@pomsky-lang/parser/rule'
import type { Span, Rule, LetStmt } from '@pomsky-lang/parser/rule'

export function findDefinition(rule: Rule, offset: number): Span | undefined {
  const name = findName(rule, offset)
  if (!name) return
  return findDefinitionImpl(rule, offset, name)
}

function findDefinitionImpl(rule: Rule, offset: number, name: string): Span | undefined {
  if (!includes(rule.span, offset)) {
    return
  }

  switch (rule.$r) {
    case RuleKind.Group:
    case RuleKind.Alternation:
    case RuleKind.Intersection:
      for (const part of rule.rules) {
        const def = findDefinitionImpl(part, offset, name)
        if (def) return def
      }
      return

    case RuleKind.Lookaround:
    case RuleKind.Negation:
    case RuleKind.Repetition:
      return findDefinitionImpl(rule.rule, offset, name)

    case RuleKind.StmtExpr: {
      const [stmts, inner] = reduceLetStmts(rule)

      const innerDef = findDefinitionImpl(inner, offset, name)
      if (innerDef) return innerDef

      const nameSpan = stmts.find(stmt => includes(stmt.nameSpan, offset))?.nameSpan
      if (nameSpan) return nameSpan

      for (const stmt of stmts) {
        const def = findDefinitionImpl(stmt.rule, offset, name)
        if (def) return def
        if (stmt.name === name) return stmt.nameSpan
      }
      return innerDef
    }

    default:
      return
  }
}

export function findUsages(rule: Rule, name: string, span: Span): Span[] {
  const acc: Span[] = []
  findUsagesImpl(rule, name, span, false, acc)
  return acc
}

function findUsagesImpl(rule: Rule, name: string, span: Span, inScope: boolean, acc: Span[]) {
  if (!inScope && !includes(rule.span, span[0])) return

  switch (rule.$r) {
    case RuleKind.Group:
    case RuleKind.Alternation:
    case RuleKind.Intersection:
      for (const part of rule.rules) {
        findUsagesImpl(part, name, span, inScope, acc)
      }
      return

    case RuleKind.Lookaround:
    case RuleKind.Negation:
    case RuleKind.Repetition:
      findUsagesImpl(rule.rule, name, span, inScope, acc)
      return

    case RuleKind.StmtExpr: {
      const [stmts, inner] = reduceLetStmts(rule)

      const inScopeNew = inScope || stmts.some(stmt => span[0] === stmt.nameSpan[0])
      const nameRedeclared = inScope && stmts.some(stmt => name === stmt.name)

      if (nameRedeclared) {
        for (const stmt of stmts) {
          // only look for usages on the RHS of the shadowing variable
          if (name === stmt.name) {
            findUsagesImpl(stmt.rule, name, span, inScopeNew, acc)
          }
        }
      } else {
        for (const stmt of stmts) {
          // don't look for usages on the RHS of the variable
          if (span[0] !== stmt.nameSpan[0]) {
            findUsagesImpl(stmt.rule, name, span, inScopeNew, acc)
          }
        }
        findUsagesImpl(inner, name, span, inScopeNew, acc)
      }
      return
    }

    case RuleKind.Variable:
      if (rule.name === name) {
        acc.push(rule.span)
      }
      return

    default:
      return
  }
}

function findName(rule: Rule, offset: number): string | undefined {
  if (!includes(rule.span, offset)) return

  switch (rule.$r) {
    case RuleKind.Group:
    case RuleKind.Alternation:
    case RuleKind.Intersection:
      for (const part of rule.rules) {
        const def = findName(part, offset)
        if (def) return def
      }
      return

    case RuleKind.Lookaround:
    case RuleKind.Negation:
    case RuleKind.Repetition:
      return findName(rule.rule, offset)

    case RuleKind.StmtExpr: {
      if (rule.stmt.$s === StmtKind.Let) {
        if (includes(rule.stmt.nameSpan, offset)) {
          return rule.stmt.name
        }
        const found = findName(rule.stmt.rule, offset)
        if (found) return found
      }
      return findName(rule.rule, offset)
    }

    case RuleKind.Variable:
      return rule.name
    case RuleKind.Reference:
      return 'name' in rule.target ? rule.target.name : undefined

    default:
      return
  }
}

function includes(span: Span, offset: number): boolean {
  return span[0] <= offset && span[1] >= offset
}

function reduceLetStmts(rule: StmtExpr): readonly [LetStmt[], Rule] {
  const letStmts: LetStmt[] = []
  if (rule.stmt.$s === StmtKind.Let) {
    letStmts.push(rule.stmt)
  }

  let inner = rule.rule
  while (inner.$r === RuleKind.StmtExpr) {
    if (inner.stmt.$s === StmtKind.Let) {
      letStmts.push(inner.stmt)
    }
    inner = inner.rule
  }

  return [letStmts, inner]
}

import { print } from 'graphql'
import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'
import { analyzeBuilderChain, isGazaniaSelectCall } from '../../../src/extract/analyze/chain'
import { collectImports } from '../../../src/extract/analyze/imports'
import { collectPartialDefs, resolveSameFilePartials } from '../../../src/extract/analyze/partial'
import { staticExtractWithPartials } from '../../../src/extract/analyze/pipeline'
import { walkAST } from '../../../src/extract/walk'

describe('partial-resolver: same-file partial/section resolution', () => {
  it('1. single same-file partial', () => {
    const code = `
      import { gazania } from 'gazania'
      const userFields = gazania.partial('UserFields').on('User').select($ => $.select(['id', 'name']))
      gazania.query('GetUser').select($ => $.select([...userFields(), 'status']))
    `
    const docs = staticExtractWithPartials(code)
    expect(docs).toHaveLength(1)

    const output = print(docs[0])
    expect(output).toContain('...UserFields')
    expect(output).toContain('fragment UserFields on User')
    expect(output).toContain('id')
    expect(output).toContain('name')
    expect(output).toContain('status')
    expect(output).toContain('query GetUser')
  })

  it('2. single same-file section', () => {
    const code = `
      import { gazania } from 'gazania'
      const postSection = gazania.section('PostSection').on('Post').select($ => $.select(['title', 'body']))
      gazania.query('GetPosts').select($ => $.select([...postSection(), 'createdAt']))
    `
    const docs = staticExtractWithPartials(code)
    expect(docs).toHaveLength(1)

    const output = print(docs[0])
    expect(output).toContain('...PostSection')
    expect(output).toContain('fragment PostSection on Post')
    expect(output).toContain('title')
    expect(output).toContain('body')
    expect(output).toContain('createdAt')
    expect(output).toContain('query GetPosts')
  })

  it('3. multiple same-file partials', () => {
    const code = `
      import { gazania } from 'gazania'
      const userInfo = gazania.partial('UserInfo').on('User').select($ => $.select(['id', 'name']))
      const userAvatar = gazania.partial('UserAvatar').on('User').select($ => $.select(['avatarUrl']))
      gazania.query('GetUserProfile').select($ => $.select([...userInfo(), ...userAvatar()]))
    `
    const docs = staticExtractWithPartials(code)
    expect(docs).toHaveLength(1)

    const output = print(docs[0])
    expect(output).toContain('...UserInfo')
    expect(output).toContain('...UserAvatar')
    expect(output).toContain('fragment UserInfo on User')
    expect(output).toContain('fragment UserAvatar on User')
    expect(output).toContain('avatarUrl')
    expect(output).toContain('query GetUserProfile')
  })

  it('4. partial forward reference (declared AFTER query)', () => {
    const code = `
      import { gazania } from 'gazania'
      gazania.query('ForwardRef').select($ => $.select([...userFields(), 'active']))
      const userFields = gazania.partial('UserFields').on('User').select($ => $.select(['id', 'email']))
    `
    const docs = staticExtractWithPartials(code)
    expect(docs).toHaveLength(1)

    const output = print(docs[0])
    expect(output).toContain('...UserFields')
    expect(output).toContain('fragment UserFields on User')
    expect(output).toContain('id')
    expect(output).toContain('email')
    expect(output).toContain('active')
    expect(output).toContain('query ForwardRef')
  })

  it('5. partial with vars', () => {
    const code = `
      import { gazania } from 'gazania'
      const filteredItems = gazania.partial('FilteredItems').on('Item').vars({ limit: 'Int!' }).select(($, vars) => $.select(['name']))
      gazania.query('GetItems').select($ => $.select([...filteredItems()]))
    `
    const docs = staticExtractWithPartials(code)
    expect(docs).toHaveLength(1)

    const output = print(docs[0])
    expect(output).toContain('...FilteredItems')
    expect(output).toContain('fragment FilteredItems')
    expect(output).toContain('on Item')
    const doc = docs[0]
    const frag = doc.definitions.find((d: any) => d.kind === 'FragmentDefinition') as any
    expect(frag).toBeDefined()
    expect(frag.variableDefinitions).toHaveLength(1)
    expect(frag.variableDefinitions[0].variable.name.value).toBe('limit')
    expect(frag.variableDefinitions[0].type.type.name.value).toBe('Int')
  })

  it('6. partial with directives', () => {
    const code = `
      import { gazania } from 'gazania'
      const deprecatedFields = gazania.partial('DeprecatedFields').on('User').directives(() => [['@deprecated', { reason: 'use v2' }]]).select($ => $.select(['oldField']))
      gazania.query('Legacy').select($ => $.select([...deprecatedFields()]))
    `
    const docs = staticExtractWithPartials(code)
    expect(docs).toHaveLength(1)

    const output = print(docs[0])
    expect(output).toContain('...DeprecatedFields')
    expect(output).toContain('fragment DeprecatedFields on User')
    expect(output).toContain('@deprecated')
    expect(output).toContain('use v2')
  })

  it('7. collectPartialDefs returns empty map when no partials', () => {
    const ast = parseSync('test.js', `
      import { gazania } from 'gazania'
      gazania.query('Simple').select($ => $.select(['id']))
    `).program as any

    const contextMap: Record<string, unknown> = {}
    const { builderNames, namespace } = collectImports(ast, contextMap)
    const partialDefs = collectPartialDefs(ast, builderNames, namespace)

    expect(partialDefs.size).toBe(0)
  })

  it('8. collectPartialDefs finds partial and section', () => {
    const ast = parseSync('test.js', `
      import { gazania } from 'gazania'
      const p = gazania.partial('P').on('T').select($ => $.select(['a']))
      const s = gazania.section('S').on('U').select($ => $.select(['b']))
    `).program as any

    const contextMap: Record<string, unknown> = {}
    const { builderNames, namespace } = collectImports(ast, contextMap)
    const partialDefs = collectPartialDefs(ast, builderNames, namespace)

    expect(partialDefs.size).toBe(2)
    expect(partialDefs.has('p')).toBe(true)
    expect(partialDefs.has('s')).toBe(true)
    expect(partialDefs.get('p')!.name).toBe('P')
    expect(partialDefs.get('p')!.typeName).toBe('T')
    expect(partialDefs.get('s')!.name).toBe('S')
    expect(partialDefs.get('s')!.typeName).toBe('U')
  })

  it('9. resolveSameFilePartials returns selection and fragmentDefs', () => {
    const code = `
      import { gazania } from 'gazania'
      const uf = gazania.partial('UF').on('User').select($ => $.select(['id']))
      const q = gazania.query('Q').select($ => $.select([...uf(), 'name']))
    `
    const ast = parseSync('test.js', code).program as any
    const contextMap: Record<string, unknown> = {}
    const { builderNames, namespace } = collectImports(ast, contextMap)

    const partialDefs = collectPartialDefs(ast, builderNames, namespace)
    expect(partialDefs.size).toBe(1)

    const chains: any[] = []
    walkAST(ast, (node: any) => {
      if (!isGazaniaSelectCall(node, builderNames, namespace)) {
        return
      }
      const chain = analyzeBuilderChain(node, builderNames, namespace)
      if (chain) {
        chains.push(chain)
      }
    })

    const queryChain = chains.find(c => c.type === 'query')
    expect(queryChain).toBeDefined()

    const { selection, fragmentDefs } = resolveSameFilePartials(queryChain, partialDefs)

    expect(selection).toHaveLength(1)
    expect(selection).toContain('name')
    expect(fragmentDefs).toHaveLength(1)
    expect(fragmentDefs[0].name.value).toBe('UF')
    expect(fragmentDefs[0].typeCondition.name.value).toBe('User')
  })

  it('10. partial-only selection (empty non-spread selection)', () => {
    const code = `
      import { gazania } from 'gazania'
      const allFields = gazania.partial('AllFields').on('Item').select($ => $.select(['id', 'label']))
      gazania.query('GetAll').select($ => $.select([...allFields()]))
    `
    const docs = staticExtractWithPartials(code)
    expect(docs).toHaveLength(1)

    const output = print(docs[0])
    expect(output).toContain('...AllFields')
    expect(output).toContain('fragment AllFields on Item')
    expect(output).toContain('id')
    expect(output).toContain('label')
    expect(output).toContain('query GetAll')
  })
})

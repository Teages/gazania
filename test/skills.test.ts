import fs from 'node:fs'
import path from 'node:path'
import { print } from 'graphql'
import { describe, expect, it } from 'vitest'
import { gazania } from '../src'

const skillDoc = fs.readFileSync(path.resolve(__dirname, '../skills/gazania/SKILL.md'), 'utf8')
const normalizeGraphql = (value: string) => value.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()

function expectDocContainsQuery(query: string) {
  expect(normalizeGraphql(skillDoc)).toContain(normalizeGraphql(query))
}

describe('skills examples', () => {
  it('basic query example', () => {
    const GetHelloQuery = gazania.query('GetHello')
      .select($ => $.select(['hello']))

    const output = print(GetHelloQuery)

    expect(output).toMatchInlineSnapshot(`
      "query GetHello {
        hello
      }"
    `)
    expectDocContainsQuery(output)
  })

  it('variables and arguments example', () => {
    const FindAdminQuery = gazania.query('FindAdmin')
      .vars({ name: 'String!' })
      .select(($, vars) => $.select([{
        users: $ => $.args({ name: vars.name, first: 1, role: gazania.enum('ADMIN') })
          .select(['id', 'name', 'email']),
      }]))

    const output = print(FindAdminQuery)

    expect(output).toMatchInlineSnapshot(`
      "query FindAdmin($name: String!) {
        users(name: $name, first: 1, role: ADMIN) {
          id
          name
          email
        }
      }"
    `)
    expectDocContainsQuery(output)
  })

  it('directive example', () => {
    const WithDirectiveQuery = gazania.query('WithDirective')
      .vars({ includeEmail: 'Boolean!' })
      .directives(vars => [['@cache', { disable: vars.includeEmail }]])
      .select(($, vars) => $.select([{
        users: $ => $.args({ first: 1 })
          .select([
            'id',
            'name',
            {
              email: $ => $.directives(['@include', { if: vars.includeEmail }]),
            },
          ]),
      }]))

    const output = print(WithDirectiveQuery)

    expect(output).toMatchInlineSnapshot(`
      "query WithDirective($includeEmail: Boolean!) @cache(disable: $includeEmail) {
        users(first: 1) {
          id
          name
          email @include(if: $includeEmail)
        }
      }"
    `)
    expectDocContainsQuery(output)
  })

  it('splitting / reuse query example', () => {
    const UserBasicInfo_UserFragment = gazania.partial('UserBasicInfo_User')
      .on('User')
      .select($ => $.select(['id', 'name', 'email']))

    const UserBasicInfoQuery = gazania.query('UserBasicInfo')
      .select(($, vars) => $.select([{
        users: $ => $.args({ first: 1 })
          .select([
            ...UserBasicInfo_UserFragment(vars),
          ]),
      }]))

    const output = print(UserBasicInfoQuery)

    expect(output).toMatchInlineSnapshot(`
      "query UserBasicInfo {
        users(first: 1) {
          ...UserBasicInfo_User
        }
      }

      fragment UserBasicInfo_User on User {
        id
        name
        email
      }"
    `)
    expectDocContainsQuery(output)
  })
})

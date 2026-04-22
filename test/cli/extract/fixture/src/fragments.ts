import { gazania } from './index'

export const UserPartial = gazania.partial('UserFragment')
  .on('User')
  .select($ => $.select(['id', 'name']))

export const UserSection = gazania.section('UserSection')
  .on('User')
  .select($ => $.select(['id']))

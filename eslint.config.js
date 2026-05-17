import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    curly: ['error', 'all'],
  },
})
  // docs
  .append({
    // disable unnecessary rules for markdown files
    files: ['docs/**/*.md/*.ts', 'docs/**/*.md/*.js'],
    rules: {
      'ts/no-empty-object-type': 'off',
    },
  })

  .append({
    ignores: ['playground/gazania/**/*.ts', 'examples/**/generated/**/*.ts'],
  })

  // fixtures
  .append({
    files: ['test/**/fixtures/**/*'],
    rules: {
      'eslint-comments/no-unlimited-disable': 'off',
      'antfu/no-top-level-await': 'off',
      'no-console': 'off',
    },
  })

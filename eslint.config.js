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

  // playground
  .append({
    ignores: ['playground/gazania/**/*.ts'],
  })

  // examples
  .append({
    files: ['examples/**/*'],
    rules: {
      'eslint-comments/no-unlimited-disable': 'off',
    },
  })

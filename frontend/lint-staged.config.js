export default {
  '*.{js,jsx}': ['eslint', 'prettier --check'],
  '*.css': ['stylelint', 'prettier --check'],
  '*.{json,html,md}': 'prettier --check',
}

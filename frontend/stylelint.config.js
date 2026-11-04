export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'at-rule-no-unknown': [true, { ignoreAtRules: ['theme'] }],
    'import-notation': 'string',
    // Prettier owns whitespace.
    'rule-empty-line-before': null,
    'at-rule-empty-line-before': null,
  },
}

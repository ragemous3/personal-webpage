// https://www.npmjs.com/package/prettier-plugin-go-template
export default {
  tabWidth: 2,
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  plugins: ['prettier-plugin-go-template'],
  goTemplateBracketSpacing: true,
  overrides: [
    {
      files: ['*.html'],
      options: {
        parser: 'go-template',
      },
    },
  ],
};

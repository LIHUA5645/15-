// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
module.exports = {
  root: true,
  env: { browser: true, node: true, es2021: true },
  parserOptions: { ecmaVersion: 2021, sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18' } },
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  plugins: ['react'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist', 'node_modules', 'dist_electron', 'release'],
};

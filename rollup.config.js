const plugins = [
  require('rollup-plugin-json')(),
  require('rollup-plugin-commonjs')(),
  require('rollup-plugin-node-resolve')(),
  require('rollup-plugin-node-globals')(),
  require('rollup-plugin-terser').terser(),
];

module.exports = [
  {
    input: 'lib/unexpectedMessy.js',
    output: {
      file: 'unexpectedMessy.min.js',
      name: 'unexpectedMessy',
      exports: 'named',
      format: 'umd',
      sourcemap: false,
      strict: false,
    },
    plugins,
  },
];

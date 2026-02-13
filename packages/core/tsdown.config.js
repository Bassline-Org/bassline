import { defineConfig } from 'tsdown'
import babel from '@rollup/plugin-babel';


export default defineConfig({
    entry: 'src/alt/index.js',
    plugins: [babel({ babelHelpers: 'bundled' })]
})
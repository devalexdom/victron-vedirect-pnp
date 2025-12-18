import typescript from 'rollup-plugin-typescript2'
import babel from '@rollup/plugin-babel'
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';

export default [
    // ES Modules
    {
        input: 'src/index.ts',
        output: [{
            file: 'dist/index.js', format: 'cjs',
        }
        ],
        plugins: [
            commonjs(),
            typescript({ useTsconfigDeclarationDir: true }),
            babel({ extensions: ['.ts'] }),
            terser()
        ],
    },
]
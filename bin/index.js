#!/usr/bin/env node
const fs = require('fs')
const { join } = require('path')
const { promisify } = require('util')
const childProcess = require('child_process')
const askQuestion = require('./ask-question.js')

const mkdir = promisify(fs.mkdir)
const exec = promisify(childProcess.exec)
const read = promisify(fs.readFile)
const write = promisify(fs.writeFile)
const cp = promisify(fs.cp)

/*
 * calculate project directory name
 */
const defaultFolderName = 'new-typescript-package'
const initWorkingDirectory = process.cwd()

let folderName = defaultFolderName
if (process.argv.slice(2).length > 0) {
    folderName = process.argv.slice(2)[0]
}
const projectWorkingDirectory = join(initWorkingDirectory, folderName)
/* END */

async function main () {
    /*
     * make new directory and move into it
     */
    console.log(`creating directory ${folderName}`)
    await mkdir(projectWorkingDirectory)
    process.chdir(projectWorkingDirectory)
    /* END */

    /*
     * initialize npm in new project directory
     */
    console.log('npm init')
    await exec('npm init --yes')
    /* END */

    /*
     * install TypeScript
     */
    console.log('installing TypeScript (this may take a while)')
    await exec('npm install --save-dev typescript @types/node')

    console.log('initializing typescript')
    await exec('npx tsc --init')

    console.log('updating tsconfig')
    let tsconfig = await read(join(projectWorkingDirectory, 'tsconfig.json'), 'utf8')
    configUpdates = [
        {
          key: "declaration",
          value: true
        },
        {
          key: "declarationMap",
          value: true
        },
        {
          key: "sourceMap",
          value: true
        },
        {
          key: "module",
          value: '"NodeNext"'
        },
        {
          key: "target",
          value: '"ES2017"'
        },
        {
          key: "moduleResolution",
          value: '"Node16"'
        },
        {
          key: "esModuleInterop",
          value: true
        },
        {
          key: "skipLibCheck",
          value: true
        },
        {
          key: "resolveJsonModule",
          value: true
        },
        {
          key: "outDir",
          value: '"./dist"'
        },
        {
            key: "rootDir",
            value: '"./src"'
        },
        {
            key: "baseUrl",
            value: '"."'
        },
        {
            key: "paths",
            value: JSON.stringify({
                "@/*": ["src/*"],
                "@utils/*": ["src/utils/*"]
            })
        },
        {
          key: "removeComments",
          value: true
        },
    ]
    const valueReg = '(("[^"]+")|(true|false)|(\\[[^\\]]*\\])|({[^}]*}))'
    configUpdates.forEach((update) => {
        const reg = new RegExp(`(\/\/)?\\s*"(${update.key})"\\s*:\\s*${valueReg}(,?\\s*\/\\*)`, "gm")
        tsconfig = tsconfig.replace(reg, (match, p1, p2, p3, p4, p5, p6, p7, p8) => {
          return `${p1 ? '' : '\n    '}"${p2}": ${update.value}${p8 || ''}`;
        })
    })
    tsconfig = tsconfig.replace(/}\r?\n}/, `},
      "include": ["src/**/*"],
      "exclude": [
        "node_module",
        "dist",
        "test"  
      ]    
    }`)
    await write(join(projectWorkingDirectory, 'tsconfig.json'), tsconfig)

    console.log('writing tsconfig for CommonJS')
    await write(join(projectWorkingDirectory, 'tsconfig.commonjs.json'), JSON.stringify({
      extends: "./tsconfig.json",
      compilerOptions: {
        module: "CommonJS",
        moduleResolution: "Node10",
        outDir: "./dist/cjs",
        declarationDir: "./dist/cjs",
        target: "ES2015"
      },
      include: ["src/**/*"]
    }, null, 2))

    console.log('writing tsconfig for ESM')
    await write(join(projectWorkingDirectory, 'tsconfig.esm.json'), JSON.stringify({
      extends: "./tsconfig.json",
      compilerOptions: {
        outDir: "./dist/esm",
        declarationDir: "./dist/esm",
        target: "ES2020"
      },
      include: ["src/**/*"]
    }, null, 2))
    
    if (fs.existsSync(join(__dirname, '..', 'src'))) {
      console.log('copying src directory')
      await cp(join(__dirname, '..', 'src'), join(projectWorkingDirectory, 'src'), {
        recursive: true
      })
    }

    console.log('updating main in package.json')
    await exec('npm pkg set main=./dist/cjs/index.js')

    console.log('adding types to package.json')
    await exec('npm pkg set types=./dist/cjs/index.d.ts')

    console.log('adding module to package.json')
    await exec('npm pkg set module=./dist/esm/index.js')

    console.log('adding exports in package.json')
    await exec('npm pkg set exports["."].import=./dist/esm/index.js')
    await exec('npm pkg set exports["."].require=./dist/cjs/index.js')

    console.log('adding files in package.json')
    await exec('npm pkg set files[0]=dist/**/*')
    await exec('npm pkg set files[1]=README.md')

    console.log('adding build script(s)')
    await exec('npm pkg set scripts.build:cjs="tsc --project tsconfig.commonjs.json"')
    await exec('npm pkg set scripts.build:esm="tsc --project tsconfig.esm.json"')
    await exec('npm pkg set scripts.build="npm run build:cjs && npm run build:esm"')

    console.log('adding prepublishOnly script')
    await exec('npm pkg set scripts.prepublishOnly="npm run build"')

    console.log('adding clean script')
    await exec(`npm pkg set scripts.clean="node -e \\"require('fs').rmSync('./dist', { recursive: true, force: true })\\""`)

    console.log('adding prebuild script')
    await exec('npm pkg set scripts.prebuild="npm run clean"')
    /* END */

    /*
     * install tsc-alias
     */
    console.log('installing tsc-alias (this may take a while)')
    await exec('npm install --save-dev tsc-alias')

    console.log('updating build script(s)')
    await exec('npm pkg set scripts.build:cjs="tsc --project tsconfig.commonjs.json && tsc-alias -p tsconfig.commonjs.json"')
    await exec('npm pkg set scripts.build:esm="tsc --project tsconfig.esm.json && tsc-alias -p tsconfig.esm.json"')
    /* END */

    /*
     * install ESLint
     * TSLint has been deprecated in favor of ESLint
     */
    console.log('installing ESLint (this may take a while)')
    await exec('npm install --save-dev eslint@^8.56.0')

    console.log('installing typescript-eslint (this may take a while)')
    await exec('npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin')

    console.log('writing eslintrc')
    await write(join(projectWorkingDirectory, '.eslintrc'), JSON.stringify({
        "root": true,
        "parser": "@typescript-eslint/parser",
        "plugins": [
          "@typescript-eslint"
        ],
        "extends": [
          "eslint:recommended",
          "plugin:@typescript-eslint/eslint-recommended",
          "plugin:@typescript-eslint/recommended"
        ],
        "rules": { 
            "no-console": 0, // off
            "no-shadow": 1 // warn
        }
    }, null, 2))

    console.log('writing eslintignore')
    await write(join(projectWorkingDirectory, '.eslintignore'), [
        'node_modules',
        'dist',
        ''
    ].join("\n"))

    console.log('adding lint script')
    await exec('npm pkg set scripts.lint="eslint . --ext .ts,.js --fix"')
    /* END */

    /*
     * install Mocha
     */
    console.log('installing Mocha (this may take a while)')
    await exec('npm install --save-dev mocha @types/mocha')

    console.log('installing ts-node (this may take a while)')
    await exec('npm install --save-dev ts-node tsconfig-paths')

    console.log('installing cross-env (this may take a while)')
    await exec('npm install --save-dev cross-env')

    console.log('writing mocharc')
    await write(join(projectWorkingDirectory, '.mocharc.json'), JSON.stringify({
      "extension": [
        "ts"
      ],
      "spec": "tests/**/*.ts",
      "require": [
        "ts-node/register",
        "tsconfig-paths/register"
      ],
      "recursive": true
    }, null, 2))

    console.log('writing test tsconfig')
    await write(join(projectWorkingDirectory, 'tsconfig.test.json'), JSON.stringify({
      extends: "./tsconfig.json",
      compilerOptions: {
        module: "CommonJS",
        target: "ES2020",
        outDir: "./dist/test",
        rootDir: "./",
        noEmit: false,
        types: ["node", "mocha"],
        sourceMap: true,
        baseUrl: ".",
        paths: {
          "@/*": ["src/*"],
          "@utils/*": ["src/utils/*"]
        },
        esModuleInterop: true
      },
      include: [
        "src/**/*.ts",
        "tests/**/*.ts"
      ],
      exclude: [
        "node_modules",
        "dist"
      ]
    }, null, 2))

    if (fs.existsSync(join(__dirname, '..', 'tests'))) {
      console.log('copying tests directory')
      await cp(join(__dirname, '..', 'tests'), join(projectWorkingDirectory, 'tests'), {
        recursive: true
      })
    }

    console.log('adding test script')
    await exec(`npm pkg set scripts.test="cross-env TS_NODE_PROJECT='./tsconfig.test.json' mocha"`)
    /* END */

    /*
     * initialize and configure git
     * ALWAYS goes last
     */
    const usingGit = !!(
        await askQuestion('Are you using git (Y/n)? ', 'y', (a) => a.trim().match(/^(y|n|yes|no)$/i) ? true : 'Please enter y or n')
    ).trim().match(/^(y|yes)$/i)
    if (usingGit) {
        const gitUrl = await askQuestion('What is the URL for your Git repo? ')
        
        console.log('setting package repository')
        await exec('npm pkg set repository.type=git')
        await exec(`npm pkg set repository.url=git+${gitUrl}.git`)
    
        console.log('setting package bugs')
        await exec(`npm pkg set bugs.url=${gitUrl}/issues`)

        console.log('setting package homepage')
        await exec(`npm pkg set homepage=${gitUrl}#readme`)

        console.log('adding node gitignore')
        await exec('npx gitignore node')

        if (fs.existsSync(join(__dirname, 'github'))) {
          console.log('copying github directory')
          await cp(join(__dirname, 'github'), join(projectWorkingDirectory, '.github'), {
            recursive: true
          })
        }
    
        console.log('git init')
        await exec('git init')
    
        console.log('initial commit')
        await exec('git add --all')
        await exec('git commit -m "initial commit"')
    
        console.log('adding git remote origin')
        await exec(`git remote add origin ${gitUrl}.git`)
    }
    /* END */
}

main()
    .catch((err) => {
      console.error('Error: ', err)
      process.exit(1)
    })
    .then(() => {
        console.log('Done')
    })

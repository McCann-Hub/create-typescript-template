#!/usr/bin/env node
const fs = require('fs');
const { join } = require('path');
const { promisify } = require('util');
const childProcess = require('child_process');
const askQuestion = require('./ask-question.js');

const mkdir = promisify(fs.mkdir);
const exec = promisify(childProcess.exec);
const read = promisify(fs.readFile);
const write = promisify(fs.writeFile);
const cp = promisify(fs.cp);

/*
 * calculate project directory name
 */
const defaultFolderName = 'new-typescript-package';
const initWorkingDirectory = process.cwd();

let folderName = defaultFolderName;
if (process.argv.slice(2).length > 0) {
  folderName = process.argv.slice(2)[0];
}
const projectWorkingDirectory = join(initWorkingDirectory, folderName);
/* END */

async function main() {
  /*
   * make new directory and move into it
   */
  console.log(`creating directory ${folderName}`);
  await mkdir(projectWorkingDirectory);
  process.chdir(projectWorkingDirectory);
  /* END */

  /*
   * initialize npm in new project directory
   */
  console.log('npm init');
  await exec('npm init --yes');
  await exec('npm pkg set version=0.0.0');
  /* END */

  /*
   * install TypeScript
   */
  console.log('installing TypeScript (this may take a while)');
  await exec('npm install --save-dev typescript @types/node');

  console.log('initializing typescript');
  await exec('npx tsc --init');

  console.log('updating tsconfig');
  let tsconfig = await read(
    join(projectWorkingDirectory, 'tsconfig.json'),
    'utf8'
  );
  configUpdates = [
    {
      key: 'target',
      value: '"ES2019"',
    },
    {
      key: 'module',
      value: '"Node18"',
    },
    {
      key: 'rootDir',
      value: '"./src"',
    },
     {
      key: 'moduleResolution',
      value: '"Node16"',
    },
    {
      key: 'baseUrl',
      value: '"."',
    },
    {
      key: 'paths',
      value: JSON.stringify({
        '@/*': ['src/*'],
        '@utils/*': ['src/utils/*'],
      }),
    },
    {
      key: 'rewriteRelativeImportExtensions',
      value: true,
    },  
    {
      key: 'declaration',
      value: true,
    },
    {
      key: 'sourceMap',
      value: true,
    },
    {
      key: 'outDir',
      value: '"./dist"',
    },
    {
      key: 'removeComments',
      value: false,
    },
    {
      key: 'esModuleInterop',
      value: true,
    },
    {
      key: 'skipLibCheck',
      value: true,
    },
  ];
  const valueReg = '(("[^"]+")|(true|false)|(\\[[^\\]]*\\])|({[^}]*}))';
  configUpdates.forEach((update) => {
    const reg = new RegExp(
      `(\/\/)?\\s*"(${update.key})"\\s*:\\s*${valueReg}(,?\\s*\/\\*)`,
      'gm'
    );
    tsconfig = tsconfig.replace(
      reg,
      (match, p1, p2, p3, p4, p5, p6, p7, p8) => {
        return `${p1 ? '' : '\n    '}"${p2}": ${update.value}${p8 || ''}`;
      }
    );
  });
  tsconfig = tsconfig.replace(
    /}\r?\n}/,
    `},
      "include": ["src/**/*"],
      "exclude": [
        "node_modules",
        "dist",
        "tests"  
      ]    
    }`
  );
  await write(join(projectWorkingDirectory, 'tsconfig.json'), tsconfig);

  console.log('writing tsconfig for CommonJS');
  await write(
    join(projectWorkingDirectory, 'tsconfig.commonjs.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          module: 'CommonJS',
          moduleResolution: 'Node10',
          target: 'ES5',
          outDir: './dist/cjs',
          declaration: false,
          declarationMap: false,
        },
      },
      null,
      2
    )
  );

  console.log('writing tsconfig for ESM');
  await write(
    join(projectWorkingDirectory, 'tsconfig.esm.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2023',
          outDir: './dist/esm',
          declaration: false,
          declarationMap: false,
         },
      },
      null,
      2
    )
  );

  console.log('writing tsconfig for Types');
  await write(
    join(projectWorkingDirectory, 'tsconfig.types.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: './dist/types',
          emitDeclarationOnly: true,
          declaration: true,
          declarationMap: true,
         },
      },
      null,
      2
    )
  );

  if (fs.existsSync(join(__dirname, '..', 'src'))) {
    console.log('copying src directory');
    await cp(
      join(__dirname, '..', 'src'),
      join(projectWorkingDirectory, 'src'),
      {
        recursive: true,
      }
    );
  }

  console.log('updating main in package.json');
  await exec('npm pkg set main=./dist/cjs/index.js');

  console.log('adding types to package.json');
  await exec('npm pkg set types=./dist/types/index.d.ts');

  console.log('adding module to package.json');
  await exec('npm pkg set module=./dist/esm/index.js');

  console.log('setting type in package.json');
  await exec('npm pkg set type=module');

  console.log('adding exports in package.json');
  await exec('npm pkg set exports["."].import=./dist/esm/index.js');
  await exec('npm pkg set exports["."].require=./dist/cjs/index.js');
  await exec('npm pkg set exports["."].types=./dist/types/index.js');

  console.log('adding files in package.json');
  await exec('npm pkg set files[0]=dist/**/*');
  await exec('npm pkg set files[1]=README.md');

  console.log('adding build script(s)');
  await exec(
    'npm pkg set scripts.build:cjs="tsc --project tsconfig.commonjs.json"'
  );
  await exec('npm pkg set scripts.build:esm="tsc --project tsconfig.esm.json"');
  await exec(
    'npm pkg set scripts.build="npm run build:cjs && npm run build:esm"'
  );
  await exec('npm pkg set scripts.build:types="tsc --project tsconfig.types.json"');

  console.log('adding prepublishOnly script');
  await exec('npm pkg set scripts.prepublishOnly="npm run build"');

  console.log('adding clean script');
  await exec(
    `npm pkg set scripts.clean="node -e \\"require('fs').rmSync('./dist', { recursive: true, force: true })\\""`
  );

  console.log('adding prebuild script');
  await exec('npm pkg set scripts.prebuild="npm run clean"');
  
  console.log('adding postbuild script');
  await exec('npm pkg set scripts.prebuild="npm run build:types"');
/* END */

  /*
   * install tsc-alias
   */
  console.log('installing tsc-alias (this may take a while)');
  await exec('npm install --save-dev tsc-alias');

  console.log('updating build script(s)');
  await exec(
    'npm pkg set scripts.build:cjs="tsc --project tsconfig.commonjs.json && tsc-alias -p tsconfig.commonjs.json"'
  );
  await exec(
    'npm pkg set scripts.build:esm="tsc --project tsconfig.esm.json && tsc-alias -p tsconfig.esm.json"'
  );
  /* END */

  /*
   * install ESLint
   * TSLint has been deprecated in favor of ESLint
   */
  console.log('installing ESLint (this may take a while)');
  await exec('npm install --save-dev eslint@^8.56.0');

  console.log('installing typescript-eslint (this may take a while)');
  await exec(
    'npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin'
  );

  console.log('writing eslintrc');
  await write(
    join(projectWorkingDirectory, '.eslintrc'),
    JSON.stringify(
      {
        root: true,
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        extends: [
          'eslint:recommended',
          'plugin:@typescript-eslint/eslint-recommended',
          'plugin:@typescript-eslint/recommended',
        ],
        rules: {
          'no-console': 0, // off
          'no-shadow': 1, // warn
        },
      },
      null,
      2
    )
  );

  console.log('writing eslintignore');
  await write(
    join(projectWorkingDirectory, '.eslintignore'),
    ['node_modules', 'dist', ''].join('\n')
  );

  console.log('adding lint script');
  await exec('npm pkg set scripts.lint="eslint . --ext .ts,.js --fix"');
  /* END */

  /*
   * install Mocha
   */
  console.log('installing Mocha (this may take a while)');
  await exec('npm install --save-dev mocha @types/mocha');

  console.log('installing tsx (this may take a while)');
  await exec('npm install --save-dev tsx tsconfig-paths');

  console.log('installing cross-env (this may take a while)');
  await exec('npm install --save-dev cross-env');

  console.log('writing mocharc');
  await write(
    join(projectWorkingDirectory, '.mocharc.json'),
    JSON.stringify(
      {
        extension: ['ts'],
        spec: 'tests/**/*.spec.ts',
        require: ['tsx', 'tsconfig-paths/register'],
        recursive: true,
      },
      null,
      2
    )
  );

  console.log('writing test tsconfig');
  await write(
    join(projectWorkingDirectory, 'tsconfig.test.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          module: 'CommonJS',
          target: 'ES2017',
          outDir: './dist/test',
          rootDir: './',
          noEmit: false,
          types: ['node', 'mocha'],
          sourceMap: true,
          baseUrl: '.',
          paths: {
            '@/*': ['src/*'],
            '@utils/*': ['src/utils/*'],
          },
          esModuleInterop: true,
        },
        include: ['src/**/*.ts', 'tests/**/*.spec.ts'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2
    )
  );

  if (fs.existsSync(join(__dirname, '..', 'tests'))) {
    console.log('copying tests directory');
    await cp(
      join(__dirname, '..', 'tests'),
      join(projectWorkingDirectory, 'tests'),
      {
        recursive: true,
      }
    );
  }

  console.log('adding test script');
  await exec(
    `npm pkg set scripts.test="cross-env TSX_TSCONFIG_PATH='./tsconfig.test.json' mocha"`
  );
  /* END */

  /*
   * deno
   */
  try {
    await exec('deno --version');
    await write(
      join(projectWorkingDirectory, 'deno.json'),
      JSON.stringify(
        {
          name: folderName,
          version: '0.0.0',
          exports: './src/index.ts',
          tasks: {
            dev: 'deno test --watch ./src/index.ts',
          },
          license: 'MIT',
          imports: {
            '@/': './src/',
            '@utils/': './src/utils/',
            '@std/assert': 'jsr:@std/assert@1',
          },
          lint: {
            include: ['./src/'],
            exclude: ['./tests/**/*.spec.ts'],
            rules: {
              tags: ['recommended'],
            },
          },
          fmt: {
            useTabs: false,
            lineWidth: 80,
            indentWidth: 2,
            semiColons: true,
            singleQuote: true,
            proseWrap: 'preserve',
            include: ['./src/'],
            exclude: ['./tests/**/*.spec.ts'],
          },
          nodeModulesDir: 'auto',
          exclude: ['./dist/'],
          publish: {
            include: ['./src/', 'README.md', 'deno.json'],
          },
        },
        null,
        2
      )
    );
  } catch (error) {
    if (error.message.includes('not found')) {
      console.log('error finding deno, skipping deno setup');
    } else {
      console.log(`error: ${error.message}`);
    }
  }
  /* END */

  /*
   * initialize and configure git
   * ALWAYS goes last
   */
  const usingGit = !!(
    await askQuestion('Are you using git (Y/n)? ', 'y', (a) =>
      a.trim().match(/^(y|n|yes|no)$/i) ? true : 'Please enter y or n'
    )
  )
    .trim()
    .match(/^(y|yes)$/i);
  if (usingGit) {
    const gitUrl = await askQuestion('What is the URL for your Git repo? ');

    console.log('setting package repository');
    await exec('npm pkg set repository.type=git');
    await exec(`npm pkg set repository.url=git+${gitUrl}.git`);

    console.log('setting package bugs');
    await exec(`npm pkg set bugs.url=${gitUrl}/issues`);

    console.log('setting package homepage');
    await exec(`npm pkg set homepage=${gitUrl}#readme`);

    console.log('adding node gitignore');
    await exec('npx gitignore node');

    if (fs.existsSync(join(__dirname, 'github'))) {
      console.log('copying github directory');
      await cp(
        join(__dirname, 'github'),
        join(projectWorkingDirectory, '.github'),
        {
          recursive: true,
        }
      );
    }

    console.log('git init');
    await exec('git init');

    console.log('initial commit');
    await exec('git add --all');
    await exec('git commit -m "initial commit"');

    console.log('adding git remote origin');
    await exec(`git remote add origin ${gitUrl}.git`);
  }
  /* END */
}

main()
  .catch((err) => {
    console.error('Error: ', err);
    process.exit(1);
  })
  .then(() => {
    console.log('Done');
  });

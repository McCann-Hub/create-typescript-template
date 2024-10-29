# TypeScript Project Initializer

A CLI tool to generate a TypeScript project setup with CommonJS and ESM support, path aliases, linting, unit testing, and Git integration.
This tool streamlines the creation of a fully configured TypeScript project, ready for development and publishing.

## Features

- **Dual Module Support**: Configures both CommonJS and ESM module support, allowing flexible usage.
- **Path Aliases**: Sets up path aliases for easy and organized imports within the project.
- **ESLint Integration**: Includes ESLint with recommended TypeScript rules for maintaining code quality.
- **Unit Testing**: Configures Mocha for unit testing.
- **Git Integration**: Initializes a Git repository and adds Git information to `package.json`.
- **NPM Publishing Ready**: Prepares the project for publishing to both npm and GitHub Package Registry.

## Requirements

- **Node.js** (version 14 or later)
- **npm** or **yarn**

## Usage

Run `npm init` referencing this project as the initializer and passing in the name of your new project

```bash
npm init @mccann-hub/typescript-template my-typescript-package
```

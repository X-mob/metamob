module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    //"plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_|^args$",
        varsIgnorePattern: "^_",
      },
    ],
    "node/no-extraneous-import": "off",
    "node/no-unsupported-features/es-syntax": "off",
    "node/no-missing-import": [
      "error",
      {
        allowModules: [],
        resolvePaths: ["*"],
        tryExtensions: [".js", ".json", ".node", ".ts"],
      },
    ],
  },
};

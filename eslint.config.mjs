import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

const tsRecommended = tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts"],
}));

// 公共规则：Node 侧脚本与 TS 源码共用
const commonRules = {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    "no-console": "off",
    eqeqeq: ["error", "always", { null: "ignore" }],
    "no-var": "error",
    "prefer-const": ["warn", { destructuring: "all" }],
};

export default [
    // 全局忽略。
    // mainline.js / mainline.min.js 是 `npm run build` 的产物且被 git 跟踪；
    // 对打包/压缩代码跑 lint 只会产出上百条无意义告警（实测 36 error / 75 warning 全来自它们）。
    // 产物由 build + 回归测试脚本把关，不靠 eslint。
    {
        ignores: [
            "node_modules/**",
            "mainline.js",
            "mainline.min.js",
            "dist/**",
            "backup/**",
            "nas-compose/**",
            "ruleset/**",
        ],
    },

    // Node 侧 CommonJS 脚本（*.cjs：build 与回归测试）
    {
        files: ["**/*.cjs"],
        languageOptions: {
            ecmaVersion: 2026,
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "writable",
                exports: "writable",
                __dirname: "readonly",
                __filename: "readonly",
                process: "readonly",
                console: "readonly",
                Buffer: "readonly",
            },
        },
        rules: { ...js.configs.recommended.rules, ...commonRules },
    },

    // Node 侧 ESM 脚本（*.mjs，如 scripts/build.mjs）
    {
        files: ["**/*.mjs"],
        languageOptions: {
            ecmaVersion: 2026,
            sourceType: "module",
            globals: {
                process: "readonly",
                console: "readonly",
                Buffer: "readonly",
            },
        },
        rules: { ...js.configs.recommended.rules, ...commonRules },
    },

    // TypeScript 源码
    ...tsRecommended,
    {
        files: ["**/*.ts"],
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
            ],
        },
    },

    // 关闭所有与 Prettier 格式冲突的 ESLint 规则（必须放最后）
    prettierConfig,
];

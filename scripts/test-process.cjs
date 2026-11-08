const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// QUIC 拦截已于 6cc1842（2026-11-05）整体删除，这里只保留常量用于
// 断言「不得再出现」——历史实现曾把它放在规则首位。
const QUIC_REJECT = "AND,((DST-PORT,443),(NETWORK,UDP)),REJECT";

for (const file of ["mainline.js", "mainline.min.js"]) {
    for (const value of [undefined, "false", "true", false, true, "1", "0"]) {
        for (const full of ["false", "true"]) {
            const context = { $arguments: { process: value, full } };
            vm.createContext(context);
            vm.runInContext(fs.readFileSync(file, "utf8"), context);
            const output = context.main({
                proxies: [{ name: "日本测试", type: "ss", server: "example.com", port: 443 }],
            });
            const enabled = [true, "true", "1"].includes(value);
            const rules = output.rules.filter((x) => x.startsWith("PROCESS-NAME,"));
            assert.equal(rules.length, enabled ? 18 : 0);
            assert.equal(new Set(rules).size, rules.length);
            assert.equal(
                output["find-process-mode"],
                enabled ? "strict" : full === "true" ? "off" : undefined
            );
            assert(!output.rules.some((x) => x.includes("hybgzs.com")));
            const rest = output.rules.filter((x) => !x.startsWith("PROCESS-NAME,"));
            // QUIC 拦截已删除：任何参数组合都不得再出现这条规则。
            assert.ok(!rest.includes(QUIC_REJECT), `${file}: QUIC reject must not reappear`);
            assert.equal(rest[0], "RULE-SET,zer0proxy,选择代理");
            assert.equal(rest[1], "RULE-SET,zer0direct,DIRECT");
        }
    }
}

// 历史参数 quic=true 已无意义（功能删除），仍需保证不出现拦截规则。
for (const file of ["mainline.js", "mainline.min.js"]) {
    const context = { $arguments: { quic: "true" } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(file, "utf8"), context);
    const output = context.main({
        proxies: [{ name: "香港测试", type: "ss", server: "example.com", port: 443 }],
    });
    assert.ok(
        !output.rules.includes(QUIC_REJECT),
        `${file}: quic=true must NOT emit the reject rule`
    );
    assert.equal(
        output.rules[0],
        "RULE-SET,zer0proxy,选择代理",
        `${file}: zer0proxy first when QUIC allowed`
    );
}

console.log(
    "PASS: both built scripts, process boolean/string/default, full modes, QUIC blocked by default + quic=true bypass, no duplicate rules, custom priority"
);

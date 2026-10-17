const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

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
            // QUIC 默认拦截（quic 未传/false），必须位于规则最前面。
            assert.equal(rest[0], QUIC_REJECT, `${file}: QUIC reject rule must be first`);
            assert.equal(rest[1], "RULE-SET,zer0proxy,选择代理");
            assert.equal(rest[2], "RULE-SET,zer0direct,DIRECT");
        }
    }
}

// quic=true 时必须放行：不得出现拦截规则，zer0proxy 回到首位。
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

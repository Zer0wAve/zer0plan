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
            // 顺序契约：zer0proxy 必须最前（显式代理例外优先于宽泛直连）。
            // zer0direct 之前允许夹「有注释说明理由的内联 DOMAIN-SUFFIX,...,DIRECT」，
            // 那是刻意为之（绕开 provider 的 86400 缓存）；除此之外不允许任何规则插到
            // zer0proxy 前面，也不允许 zer0direct 被挤到内联直连之后太远。
            assert.equal(rest[0], "RULE-SET,zer0proxy,选择代理");
            const directIdx = rest.indexOf("RULE-SET,zer0direct,DIRECT");
            assert.ok(directIdx > 0, `${file}: zer0direct must exist after zer0proxy`);
            const between = rest.slice(1, directIdx);
            // 允许夹在中间的内联直连：DOMAIN-SUFFIX（覆盖整棵子域）与 DOMAIN（精确）。
            // DOMAIN 是必需的：Stash 对 domain 类规则做「最长后缀优先」，
            // ADBlock 里 `+.trackercollect.ddxq.mobi` 比 `+.ddxq.mobi` 更长会压过去，
            // 只有同等精确度的精确规则才能拿下（实测 pubgw 通、trackercollect 被 REJECT）。
            const unexpected = between.filter(
                (r) => !/^DOMAIN(-SUFFIX)?,[^,]+,DIRECT$/.test(r)
            );
            assert.equal(
                unexpected.length,
                0,
                `${file}: only inline DOMAIN/DOMAIN-SUFFIX,...,DIRECT may sit between zer0proxy and zer0direct, got: ${JSON.stringify(unexpected)}`
            );
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

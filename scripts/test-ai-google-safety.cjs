const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// 嵌套图验收：从 AI服务 / 谷歌服务 出发，沿 proxies / 组嵌套 展开所有可达叶子，
// 断言「已知送中节点」不可达，而普通服务入口仍可达（节点没被删、没被改名）。
// 只用合成节点名做输入，不含任何真实订阅凭据。

const BAD = "LXY-🇺🇸美国01|流媒体|0.1x";
const SAFE_US = "LXY-🇺🇸美国02|流媒体|0.1x";
const SAFE_US_BKUP = "LXYbkup-🇺🇸美国03|BGP|CTCUCM";
const SAFE_SG = "LXY-🇸🇬新加坡01|流媒体|0.1x";
const SAFE_JP = "花云-🇯🇵 日本标准 IEPL 专线 1";

function mk(name, extra = {}) {
    return { name, type: "ss", server: "203.0.113.10", port: 443, ...extra };
}

function render(file, proxies, args = {}) {
    const context = { $arguments: args };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(file, "utf8"), context);
    return context.main({ proxies });
}

/** 从某个组名出发，展开所有可达的节点叶子（组名 -> 成员，递归）。 */
function reachableLeaves(config, startGroup) {
    const groups = new Map(config["proxy-groups"].map((g) => [g.name, g]));
    const nodeNames = new Set(config.proxies.map((p) => p.name));
    const leaves = new Set();
    const seenGroups = new Set();
    const stack = [startGroup];
    while (stack.length) {
        const name = stack.pop();
        const group = groups.get(name);
        if (group) {
            if (seenGroups.has(name)) continue;
            seenGroups.add(name);
            for (const member of group.proxies || []) {
                // include-all 组（GLOBAL）同时带显式 proxies 列表；没有列表时无法静态判定
                if (group["include-all"] && !(group.proxies || []).length) {
                    throw new Error(`${name}: include-all 且无显式成员，无法静态判定`);
                }
                stack.push(member);
            }
            continue;
        }
        if (name === "DIRECT" || name === "REJECT" || name === "REJECT-DROP") {
            leaves.add(name);
            continue;
        }
        if (!nodeNames.has(name)) throw new Error(`成员既不是组也不是节点: ${name}`);
        leaves.add(name);
    }
    return leaves;
}

function group(config, name) {
    const g = config["proxy-groups"].find((x) => x.name === name);
    assert.ok(g, `缺少组 ${name}`);
    return g;
}

const files = ["mainline.js", "mainline.min.js"];

for (const file of files) {
    // ── 场景 1：坏节点与健康节点并存 ─────────────────────────────────────
    const config = render(file, [
        mk(BAD),
        mk(SAFE_US),
        mk(SAFE_SG),
        mk(SAFE_JP),
        mk(SAFE_US_BKUP),
        mk("花云-🇭🇰 香港标准 IEPL 专线 1"),
        mk("花云-🇹🇼 台湾标准 IEPL 专线 1"),
    ]);

    for (const entry of ["AI服务", "谷歌服务"]) {
        const leaves = reachableLeaves(config, entry);
        assert.ok(!leaves.has(BAD), `${file}: ${entry} 仍可达已知送中节点`);
        // 除 REJECT 外，所有可达叶子都必须是具体节点（不得出现 DIRECT）
        assert.ok(!leaves.has("DIRECT"), `${file}: ${entry} 可达 DIRECT`);
        assert.ok(leaves.size > 1, `${file}: ${entry} 安全池过小，测试样本不足`);
    }

    // 手选候选不得引用地区组/低倍率组等可绕回坏节点的组
    const aiService = group(config, "AI服务");
    const groupNames = new Set(config["proxy-groups"].map((g) => g.name));
    for (const member of aiService.proxies) {
        if (groupNames.has(member)) {
            assert.equal(member, "AI故障转移", `${file}: AI服务 手选候选引用了组 ${member}`);
        }
    }
    assert.ok(
        !aiService.proxies.includes("美国节点") && !aiService.proxies.includes("低倍率节点"),
        `${file}: AI服务 仍引用通用地区/低倍率组`
    );

    // 默认路径（select 默认第一项 = AI故障转移）与故障转移组都不得含坏节点
    assert.equal(aiService.proxies[0], "AI故障转移", `${file}: AI服务 默认入口变了`);
    assert.ok(!group(config, "AI故障转移").proxies.includes(BAD));
    assert.ok(!group(config, "谷歌服务").proxies.includes(BAD));
    assert.equal(group(config, "谷歌服务").type, "select");
    // Google 默认优先美国安全节点
    assert.equal(
        group(config, "谷歌服务").proxies[0],
        SAFE_US,
        `${file}: 谷歌服务 未优先美国安全节点`
    );

    // ── 普通用途保留：节点仍在 proxies，且普通入口可达 ────────────────────
    assert.ok(
        config.proxies.some((p) => p.name === BAD),
        `${file}: 坏节点被删了（应保留普通用途）`
    );
    for (const entry of ["选择代理", "手动选择", "故障转移", "GLOBAL"]) {
        assert.ok(reachableLeaves(config, entry).has(BAD), `${file}: ${entry} 不再可达坏节点`);
    }

    // ── 场景 2：安全池全空 → fail closed ────────────────────────────────
    const onlyBad = render(file, [mk(BAD), mk("花云-🇭🇰 香港标准 IEPL 专线 1")]);
    assert.deepEqual(
        [...group(onlyBad, "AI故障转移").proxies],
        ["REJECT"],
        `${file}: 空池未 fail closed`
    );
    assert.deepEqual([...group(onlyBad, "AI服务").proxies], ["AI故障转移", "REJECT"]);
    assert.deepEqual(
        [...group(onlyBad, "谷歌服务").proxies],
        ["REJECT"],
        `${file}: Google 空池未 fail closed`
    );
    for (const entry of ["AI服务", "谷歌服务"]) {
        const leaves = reachableLeaves(onlyBad, entry);
        assert.ok(!leaves.has("DIRECT") && !leaves.has(BAD), `${file}: ${entry} 空池回落了`);
        assert.ok(!leaves.has("美国节点"), `${file}: ${entry} 空池回落通用地区组`);
    }
}

console.log(
    "PASS: AI服务/谷歌服务 嵌套可达叶子均排除已知送中节点（含默认入口与故障转移）；" +
        "普通入口仍可达该节点；安全池为空时 fail closed 到 REJECT"
);

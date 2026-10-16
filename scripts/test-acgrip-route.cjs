const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const mk = (kw, n) => Array.from({ length: n }, (_, i) => ({ name: kw + i, type: 'ss', server: 'example.com', port: 443 }));

function build(proxies) {
  const context = { $arguments: { process: 'true' } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('mainline.js', 'utf8'), context);
  return context.main({ proxies });
}

const acgrip = (out) => out.rules.filter((r) => r.includes('acgrip.com'));

// acgrip 按出口地区拦截，必须钉到港/台/新/美地区组，且该组必须真实存在。
for (const file of ['mainline.js', 'mainline.min.js']) {
  const out = vm.runInNewContext(
    `(function(){${fs.readFileSync(file, 'utf8')}\nreturn main;})()`
  )({ proxies: [...mk('香港', 2), ...mk('日本', 2)] });
  const groups = out['proxy-groups'].map((g) => g.name);
  const hit = acgrip(out);
  assert.equal(hit.length, 1, `${file}: exactly one acgrip rule`);
  assert.equal(hit[0], 'DOMAIN-SUFFIX,acgrip.com,香港节点', `${file}: binds to 香港节点`);
  assert.ok(groups.includes('香港节点'), `${file}: 香港节点 group exists`);

  const i = out.rules.indexOf(hit[0]);
  const z = out.rules.findIndex((r) => r.startsWith('RULE-SET,zer0proxy'));
  assert.ok(i < z, `${file}: acgrip must precede zer0proxy`);
}

// 日本出口整站 403，不能被选作目标组。
const jpOnly = build(mk('日本', 2));
assert.equal(acgrip(jpOnly).length, 0, 'no 港/台/新/美 group: must emit NO acgrip rule (never reference a missing group)');

// 港不可用时按优先级回落到台湾。
const tw = build([...mk('台湾', 2), ...mk('日本', 2)]);
assert.equal(acgrip(tw)[0], 'DOMAIN-SUFFIX,acgrip.com,台湾节点', 'falls back to 台湾节点');
assert.ok(tw['proxy-groups'].some((g) => g.name === '台湾节点'), '台湾节点 group exists');

// 生成的每条规则的目标组都必须存在，否则 mihomo 加载即致命错误。
for (const out of [jpOnly, tw, build([...mk('香港', 2), ...mk('日本', 2)])]) {
  const groups = new Set(out['proxy-groups'].map((g) => g.name));
  for (const rule of out.rules) {
    if (rule.startsWith('PROCESS-NAME,')) continue;
    if (rule.startsWith('MATCH,')) {
      assert.ok(groups.has(rule.split(',')[1]), `MATCH target exists: ${rule}`);
    }
  }
  assert.ok(!out.rules.some((r) => r.includes('undefined')), 'no stringified-undefined rule');
}

console.log('PASS: acgrip binding (香港 default, 台湾 fallback, absent when no region group), rule order, no missing group refs, no undefined');

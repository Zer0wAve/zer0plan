const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const file of ['mainline.js', 'mainline.min.js']) {
  for (const value of [undefined, 'false', 'true', false, true, '1', '0']) {
    for (const full of ['false', 'true']) {
      const context = { $arguments: { process: value, full } };
      vm.createContext(context);
      vm.runInContext(fs.readFileSync(file, 'utf8'), context);
      const output = context.main({ proxies: [{ name: '日本测试', type: 'ss', server: 'example.com', port: 443 }] });
      const enabled = [true, 'true', '1'].includes(value);
      const rules = output.rules.filter(x => x.startsWith('PROCESS-NAME,'));
      assert.equal(rules.length, enabled ? 18 : 0);
      assert.equal(new Set(rules).size, rules.length);
      assert.equal(output['find-process-mode'], enabled ? 'strict' : full === 'true' ? 'off' : undefined);
      assert(!output.rules.some(x => x.includes('hybgzs.com')));
      const rest = output.rules.filter(x => !x.startsWith('PROCESS-NAME,'));
      assert.equal(rest[0], 'RULE-SET,zer0proxy,选择代理');
      assert.equal(rest[1], 'RULE-SET,zer0direct,DIRECT');
    }
  }
}
console.log('PASS: both built scripts, process boolean/string/default, full modes, no duplicate rules, custom priority');

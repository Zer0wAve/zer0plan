import {
    CDN_URL,
    SPEEDTEST_URL,
    LOW_COST_NODE_MATCHER,
    NODE_SUFFIX,
    PROXY_GROUPS,
    REJECT_TARGET,
    countriesMeta,
} from "./constants";
import { AI_GOOGLE_PREFERRED_NODE_NAMES, isAiGoogleExcludedNode } from "./node_policy";
import { parseCountries } from "./node_parser";
import type { BuildProxyGroupsInput, GroupType, ProxyGroup, ProxyNode } from "./types";
import { isNotNull } from "./utils";

interface BuildGroupByTypeInput {
    name: string;
    icon: string;
    groupType: GroupType;
    nodeSource: Pick<ProxyGroup, "proxies" | "include-all" | "filter" | "exclude-filter">;
}

function buildGroupByType({
    name,
    icon,
    groupType,
    nodeSource,
}: BuildGroupByTypeInput): ProxyGroup {
    switch (groupType) {
        case 0:
            return { name, icon, type: "select", ...nodeSource };
        case 1:
            return {
                name,
                icon,
                type: "url-test",
                url: SPEEDTEST_URL,
                interval: 60,
                tolerance: 20,
                lazy: true,
                ...nodeSource,
            };
        case 2:
            return {
                name,
                icon,
                type: "load-balance",
                strategy: "sticky-sessions",
                url: SPEEDTEST_URL,
                interval: 60,
                tolerance: 20,
                lazy: true,
                ...nodeSource,
            };
    }
}

export function buildProxyGroups({
    regexFilter,
    groupType,
    countryNames,
    countryNodes,
    lowCostNodes,
    bkupNodes,
    nonLandingNodes,
    landing,
    landingNodes,
    defaultProxies,
    defaultProxiesDirect,
    defaultSelector,
    defaultFallback,
    frontProxySelector,
    telegramManual,
}: BuildProxyGroupsInput): ProxyGroup[] {
    const hasTW = countryNames.includes("台湾");
    const hasHK = countryNames.includes("香港");
    const hasBkup = bkupNodes.length > 0;

    // AI 与 Google 共用的安全出口池：只放具体节点，绝不嵌地区组/低倍率组/故障转移/
    // 选择代理——那些组会把已登记风险节点重新带回来（美国01 就是这么被选中的）。
    // 仅列入 OpenAI、Anthropic 与 Gemini API 当前均明确支持的保守地区。
    // 故意排除香港、台湾、俄罗斯与 DIRECT，避免 AI 服务触发地区限制或出口漂移。
    const aiPreferredCountries = [
        "美国",
        "新加坡",
        "日本",
        "韩国",
        "加拿大",
        "英国",
        "德国",
        "法国",
        "澳大利亚",
    ];

    // 已登记风险节点（确证 CN 或 AI/Google 旁证，见 node_policy）对 AI/Google 不可用，
    // 但仍保留在 proxies 和普通组里。
    const bkupCountries = parseCountries(bkupNodes);
    const aiRawSafeProxies = [
        ...aiPreferredCountries.flatMap((country) =>
            (countryNodes[country] || []).map((node) => node.name)
        ),
        // Apply the same country policy to backup leaves without affecting the ordinary bkup group.
        ...aiPreferredCountries.flatMap((country) =>
            (bkupCountries[country] || []).map((node) => node.name)
        ),
    ]
        .filter(isNotNull)
        .filter((name) => !isAiGoogleExcludedNode(name))
        .filter((name, idx, arr) => arr.indexOf(name) === idx);

    // 优先节点置顶（SG 已用真实模型验证，JP 仅匿名网页探测；见 node_policy），
    // 再按专线优先、最后其余安全池节点，避免 fallback 先落到死节点或未测低倍率节点。
    const aiSafeSet = new Set(aiRawSafeProxies);
    const verifiedFirst = AI_GOOGLE_PREFERRED_NODE_NAMES.filter((name) => aiSafeSet.has(name));
    const dedicatedNext = aiRawSafeProxies.filter(
        (name) => name.includes("专线") && !verifiedFirst.includes(name)
    );
    const remainingSafe = aiRawSafeProxies.filter(
        (name) => !verifiedFirst.includes(name) && !dedicatedNext.includes(name)
    );
    const aiSafeProxies = [...verifiedFirst, ...dedicatedNext, ...remainingSafe];

    // 安全池为空时 fail closed：REJECT，绝不回落到通用地区组、选择代理或 DIRECT。
    const aiSafeMembers = aiSafeProxies.length > 0 ? aiSafeProxies : [REJECT_TARGET];

    // Google 默认先走优先节点（与 AI 共享同一安全池、同一证据分级），
    // 若订阅里不含优先节点，则维持美国安全节点优先。
    const googleSafeProxies =
        verifiedFirst.length > 0
            ? aiSafeProxies
            : [
                  ...aiSafeProxies.filter((name) =>
                      (countryNodes["美国"] || []).some((n) => n.name === name)
                  ),
                  ...aiSafeProxies.filter(
                      (name) => !(countryNodes["美国"] || []).some((n) => n.name === name)
                  ),
              ];

    // Telegram 组 = fallback，成员是具体节点（按国家优先级展开），最后兜底 故障转移。
    // 绝不把 SELECT/竞速组放在首位：select 组永远不会“健康检查失败”，会导致 fallback
    // 永远卡在竞速选出的坏节点上（曾实测卡大半天，Telegram 消息发不出）。
    // 具体节点命中→持续使用（不打断 MTProto 长连接）；全失效→经 故障转移(含 bkup) 逃生。
    // 2026-11-28：订阅主力从花云换成 LXY 后，HK 住宅 IP / HK 高速01·02 / JP CTCU 全线阵亡，
    // 新加坡（BGP 专线+高速）是唯一 6/6 全通的整片，故新加坡提到第一位。
    const telegramPreferredCountries = ["新加坡", "日本", "香港", "美国", "台湾"];

    // ── 实测优先顺序（2026-11-28 全池重测版）──────────────────────────────────
    // fallback 只取**第一个健康节点**，所以顺序就是体验：排在前面 = 一直在用。
    // 这份名单是拿 api.telegram.org/bot 逐节点实测出来的（每节点 6 轮，成功率优先、
    // 同为成功再比中位延迟），不是按名字猜的。刷新方法：
    //     python3 ~/.hermes/scripts/telegram_rank_members.py --rounds 6 --all-candidates
    // 把输出的 TELEGRAM_MEASURED_ORDER 整段替换到这里，然后 build → push →
    // purge jsDelivr → mihomo-update.sh（WSL 直接拉 desktop_noflw，不再用 /api/sync/artifacts）。
    // 名单里没有的节点不会丢：未列出的按下面的原优先级追加在后面（新节点/新线路
    // 先排在队尾，等下一轮重测再往上提）。全 6 轮失败的死点故意不列——
    // 它们排最后也只会占探测预算。
    const TELEGRAM_MEASURED_ORDER = [
        // 2026-11-28 全池实测（每节点 6 轮）：以下 20 个节点 6/6 全通，按中位延迟升序。
        // 上一版名单是花云/LXYbkup 时代的，切到 LXY 后命中 0/20，才会退化成按国家取前 20
        // 把 12 个死点（HK 住宅 IP、HK 高速01/02、JP CTCU）装进组里。
        "LXY-🇸🇬新加坡专线01|BGP|流媒体",
        "LXY-🇸🇬新加坡专线04|BGP|流媒体",
        "LXY-🇸🇬新加坡专线03|BGP|流媒体",
        "LXY-🇸🇬新加坡专线02|BGP|流媒体",
        "LXY-🇸🇬新加坡高速01|BGP|CTCUCM",
        "LXY-🇸🇬新加坡高速02|BGP|CTCUCM",
        "LXY-🇸🇬新加坡高速05|BGP|CTCUCM",
        "LXY-🇸🇬新加坡高速03|BGP|CTCUCM",
        "LXY-🇸🇬新加坡高速04|BGP|CTCUCM",
        "LXY-🇯🇵日本专线02|BGP|流媒体",
        "LXY-🇯🇵日本专线01|BGP|流媒体",
        "LXY-🇯🇵日本专线04|BGP|流媒体",
        "LXY-🇯🇵日本专线03|BGP|流媒体",
        "LXY-🇭🇰香港高速05|BGP|CMCU",
        "LXY-🇭🇰香港高速04|BGP|CMCU",
        "LXY-🇭🇰香港高速03|BGP|CMCU",
        "LXY-🇺🇸美国03|流媒体|0.1x",
        "LXY-🇯🇵日本高速04|BGP|CUCM",
        "LXY-🇯🇵日本高速02|BGP|CUCM",
        "LXY-🇯🇵日本高速01|BGP|CUCM",
    ];

    // 主池节点：兼容旧花云（花云-）与新主用良心云（LXY-）
    const isMainPoolNode = (node: ProxyNode) =>
        Boolean(node.name?.startsWith("花云-") || node.name?.startsWith("LXY-"));
    const isExperimental = (node: ProxyNode) => Boolean(node.name?.includes("实验性"));
    const isAdvanced = (node: ProxyNode) => Boolean(node.name?.includes("高级"));

    // 每个优先国家内的候选节点（实验性节点仅在手机手动模式下纳入）。
    const telegramCandidatesByCountry = telegramPreferredCountries.map((country) =>
        (countryNodes[country] || [])
            .filter((node) => isMainPoolNode(node) && (telegramManual || !isExperimental(node)))
            .sort((a, b) => {
                // 国家内优先级：实验性(低倍率) > 高级 > 标准
                const rank = (node: ProxyNode) =>
                    isExperimental(node) ? 0 : isAdvanced(node) ? 1 : 2;
                return rank(a) - rank(b);
            })
    );

    // Telegram 组是 fallback：只取第一个健康节点，且无法手动切换。
    // 故低倍率(实验性)节点必须整体前置才真正生效，全不可用时自动回落到高级/标准。
    // 注意：实验性节点每个国家各一个，若只做「国家内前置」，排在首个国家之后的低倍率
    // 节点会被前面的付费节点挡住而永不启用 —— 因此把全部低倍率节点提到整体最前。
    const telegramLowCostFirst = telegramCandidatesByCountry
        .flatMap((nodes) => nodes.filter(isExperimental))
        .map((node) => node.name)
        .filter(isNotNull);
    const telegramRegular = telegramCandidatesByCountry
        .flatMap((nodes) => nodes.filter((node) => !isExperimental(node)))
        .map((node) => node.name)
        .filter(isNotNull);

    // 候选池 = 花云候选（低倍率在前 + 国家优先级）+ bkup（LXY，另一家线路），去重。
    // bkup 必须作为**具体节点**直接排进来：末尾塞「故障转移」组不会降级逃生
    // （fallback 里嵌组，子组只剩死节点时父组仍停在子组上，2026-10-30 实测确认）。
    const telegramPool = [
        ...telegramLowCostFirst,
        ...telegramRegular,
        ...bkupNodes.map((node) => node.name).filter(isNotNull),
    ].filter((name, idx, arr) => arr.indexOf(name) === idx);

    // 按实测名次重排：名单内的按名次，未列出的在原优先级后面（sort 稳定，相对顺序不变）。
    // 这一条就是"成功率高的排前面"的落地——fallback 只取第一个健康节点，谁在前面就用谁。
    const measuredRank = new Map(TELEGRAM_MEASURED_ORDER.map((name, i) => [name, i]));
    const telegramOrdered = [...telegramPool].sort((a, b) => {
        const ia = measuredRank.get(a) ?? Number.MAX_SAFE_INTEGER;
        const ib = measuredRank.get(b) ?? Number.MAX_SAFE_INTEGER;
        return ia - ib;
    });

    // 成员上限 20：探测预算 = 成员数 × interval，20 × 60s ≈ 20 次/分钟，与之前 18 个同量级。
    // 留出余量给订阅里新出现的节点（它们排在队尾，等下一轮实测再往上提）。
    const TELEGRAM_MAX_MEMBERS = 20;
    const telegramProxies = telegramOrdered.length
        ? telegramOrdered.slice(0, TELEGRAM_MAX_MEMBERS)
        : [PROXY_GROUPS.FALLBACK];

    const groups: Array<ProxyGroup | null> = [
        // 1. 选择代理
        {
            name: PROXY_GROUPS.SELECT,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Proxy.png`,
            type: "select",
            proxies: defaultSelector,
        },
        // 2. 手动选择（排除bkup节点，加bkup组入口）
        {
            name: PROXY_GROUPS.MANUAL,
            icon: `${CDN_URL}/gh/shindgewongxj/WHATSINStash@master/icon/select.png`,
            type: "select",
            proxies: [
                ...nonLandingNodes
                    .filter((n) => n.name && !/bkup/i.test(n.name))
                    .map((n) => n.name!)
                    .filter(isNotNull),
                ...(hasBkup ? [PROXY_GROUPS.BKUP] : []),
            ],
        },
        // 3. 自动选择
        {
            name: PROXY_GROUPS.AUTO,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Auto.png`,
            type: "url-test",
            url: SPEEDTEST_URL,
            proxies: defaultFallback,
            interval: 60,
            tolerance: 20,
            lazy: true,
        },
        // 4. 故障转移（排除香港节点，HK易受GFW干扰不适合做fallback）
        // 花云整体故障时应尽快切至 bkup：短间隔探测、单次失败即切换。
        {
            name: PROXY_GROUPS.FALLBACK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
            type: "fallback",
            url: SPEEDTEST_URL,
            proxies: [
                ...defaultFallback.filter((p) => p !== `香港${NODE_SUFFIX}`),
                ...(hasBkup ? [PROXY_GROUPS.BKUP] : []),
            ],
            interval: 15,
            timeout: 2500,
            "max-failed-times": 1,
            tolerance: 20,
            lazy: true,
        },
        // 5. AI服务：默认使用列表末尾的 AI故障转移；手选候选也只列安全池里的具体节点，
        //    不再挂“美国节点”等地区组（组内会包含已知送中节点，成为绕过排除的路径）。
        {
            name: PROXY_GROUPS.AI_SERVICE,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png`,
            type: "select",
            proxies: [PROXY_GROUPS.AI_FALLBACK, ...aiSafeMembers],
        },
        // 6. Telegram：独立 fallback 组。以 Telegram Bot API 本身作为健康检查目标，
        //    第一次实际连接失败即触发复检；保持 fallback 而非 url-test，避免稳定时主动换节点。
        //    2026-10-23 用户要求关掉 lazy 做预热：闲置后第一条连接不再撞死节点干等 2.5s。
        //
        //    2026-10-29 晚高峰事故：interval 300s 意味着节点在 Telegram 这条路上变差后，
        //    要等最多 5 分钟才复检换人，期间网关约四成请求报 Timed out/ConnectError
        //    （同节点访问 google/github 仍 0.16–0.7s —— 是到 Telegram DC 的路径差，不是代理坏了）。
        //    改法：成员砍到 10 个 + interval 60s。探测预算 = 10/60s ≈ 10 次/分钟，
        //    与原来 51/300s 基本相同，但发现退化从 ≤300s 缩到 ≤60s。
        {
            name: PROXY_GROUPS.TELEGRAM,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Telegram.png`,
            type: "fallback",
            // 2026-11-08：健康检查探针换成 /bot（稳定 404）。原来探 https://api.telegram.org
            // 并期望 404，但该路径现在 302 到 core.telegram.org，状态码对不上 → 探针判死、
            // 节点在 alive/dead 之间反复跳，fallback 每分钟换一次节点，MTProto 长连接被打断，
            // 用户侧表现为「一卡一卡、丢消息」。/bot 实测 GET/HEAD 都稳定 404。
            url: "https://api.telegram.org/bot",
            "expected-status": "404",
            interval: 60,
            timeout: 5000,
            "max-failed-times": 2,
            lazy: false,
            proxies: telegramProxies,
        },
        // 7. 前置代理 (conditional)
        landing
            ? {
                  name: PROXY_GROUPS.FRONT_PROXY,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Area.png`,
                  type: "select",
                  proxies: frontProxySelector,
              }
            : null,
        // 8. 落地节点 (conditional)
        landing
            ? {
                  name: PROXY_GROUPS.LANDING,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Airport.png`,
                  type: "select",
                  proxies: landingNodes.map((node) => node.name).filter(isNotNull),
              }
            : null,
        // 9. 静态资源
        {
            name: PROXY_GROUPS.STATIC_RESOURCES,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Cloudflare.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 10. 谷歌服务：与 AI服务共用同一安全出口池（已知送中节点全部排除）。
        //     默认入口是 Google故障转移（同池具体节点 + Google 健康检查），避免 select 停在
        //     某个已失效的节点上；安全池为空时 REJECT，不回落到通用美国组。
        {
            name: PROXY_GROUPS.GOOGLE,
            icon: `${CDN_URL}/gh/Orz-3/mini@master/Color/Google.png`,
            type: "select",
            proxies:
                googleSafeProxies.length > 0
                    ? [PROXY_GROUPS.GOOGLE_FALLBACK, ...googleSafeProxies]
                    : [REJECT_TARGET],
        },
        // 11. 微软服务
        {
            name: PROXY_GROUPS.MICROSOFT,
            icon: `${CDN_URL}/gh/powerfullz/override-rules@master/icons/Microsoft_Copilot.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 12. 哔哩哔哩
        {
            name: PROXY_GROUPS.BILIBILI,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/bilibili.png`,
            type: "select",
            proxies: hasTW && hasHK ? ["DIRECT", `台湾节点`, `香港节点`] : defaultProxiesDirect,
        },
        // 13. Xbox
        {
            name: PROXY_GROUPS.XBOX,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Xbox.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 14. Github
        {
            name: PROXY_GROUPS.GITHUB,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/GitHub.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 15. Video
        {
            name: PROXY_GROUPS.VIDEO,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/YouTube.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 地区节点 (dynamic, placed between Video and LOW_COST)
        ...countryNames.map((country) => {
            const meta = countriesMeta[country];
            if (!meta) return null;
            const nodeSource = regexFilter
                ? {
                      "include-all": true as const,
                      filter: meta.pattern,
                      ...(meta.excludePattern ? { "exclude-filter": meta.excludePattern } : {}),
                  }
                : {
                      proxies: countryNodes[country]?.map((n) => n.name).filter(isNotNull),
                  };
            return buildGroupByType({
                name: `${country}${NODE_SUFFIX}`,
                icon: meta.icon,
                groupType,
                nodeSource,
            });
        }),
        // 15. 低倍率节点 (conditional)
        lowCostNodes.length > 0 || regexFilter
            ? buildGroupByType({
                  name: PROXY_GROUPS.LOW_COST,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Lab.png`,
                  groupType,
                  nodeSource: !regexFilter
                      ? {
                            proxies: lowCostNodes.map((node) => node.name).filter(isNotNull),
                        }
                      : {
                            "include-all": true as const,
                            filter: LOW_COST_NODE_MATCHER.pattern,
                        },
              })
            : null,
        // 15b. 备用节点 (conditional, url-test). 预热 bkup，避免外层故障转移进入时才开始测速。
        bkupNodes.length > 0
            ? {
                  name: PROXY_GROUPS.BKUP,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
                  type: "url-test",
                  url: SPEEDTEST_URL,
                  interval: 15,
                  tolerance: 20,
                  lazy: false,
                  proxies: bkupNodes.map((node) => node.name).filter(isNotNull),
              }
            : null,
        // 16. E-Hentai
        {
            name: PROXY_GROUPS.EHENTAI,
            icon: `${CDN_URL}/gh/powerfullz/override-rules@master/icons/Ehentai.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 17. 广告拦截
        {
            name: PROXY_GROUPS.AD_BLOCK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/AdBlack.png`,
            type: "select",
            proxies: ["REJECT", "REJECT-DROP", "DIRECT"],
        },
        // 18. Final
        {
            name: PROXY_GROUPS.FINAL,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Final.png`,
            type: "select",
            proxies: [PROXY_GROUPS.SELECT, "DIRECT"],
        },
        // AI故障转移固定放在所有策略组最后；成员是同一安全池的具体节点（优先节点置顶），
        // 不再嵌 bkup 组——嵌套组会绕开已登记风险节点的排除。
        {
            name: PROXY_GROUPS.AI_FALLBACK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png`,
            type: "fallback",
            url: SPEEDTEST_URL,
            proxies: aiSafeMembers,
            interval: 60,
            tolerance: 20,
            lazy: true,
        },
        // Google故障转移：与 AI 同一安全池（优先节点置顶），健康检查打 Google 自身端点，
        // 避免 select 默认停在已失效的节点上。
        {
            name: PROXY_GROUPS.GOOGLE_FALLBACK,
            icon: `${CDN_URL}/gh/Orz-3/mini@master/Color/Google.png`,
            type: "fallback",
            url: "https://www.google.com/generate_204",
            proxies: googleSafeProxies.length > 0 ? googleSafeProxies : [REJECT_TARGET],
            interval: 60,
            tolerance: 20,
            lazy: true,
        },
    ];

    return groups.filter(isNotNull);
}

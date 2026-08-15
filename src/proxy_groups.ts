import {
  CDN_URL,
  SPEEDTEST_URL,
  LOW_COST_NODE_MATCHER,
  NODE_SUFFIX,
  PROXY_GROUPS,
  countriesMeta,
} from "./constants";
import type { BuildProxyGroupsInput, GroupType, ProxyGroup } from "./types";
import { isNotNull } from "./utils";

interface BuildGroupByTypeInput {
  name: string;
  icon: string;
  groupType: GroupType;
  nodeSource: Pick<
    ProxyGroup,
    "proxies" | "include-all" | "filter" | "exclude-filter"
  >;
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
}: BuildProxyGroupsInput): ProxyGroup[] {
  const hasTW = countryNames.includes("台湾");
  const hasHK = countryNames.includes("香港");
  const hasBkup = bkupNodes.length > 0;

  // 仅列入 OpenAI、Anthropic 与 Gemini API 当前均明确支持的保守地区。
  // 故意排除香港、台湾、俄罗斯、低倍率和 DIRECT，避免 AI 服务触发地区限制或出口漂移。
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
  const aiProxies = aiPreferredCountries
    .filter((country) => countryNames.includes(country))
    .map((country) => `${country}${NODE_SUFFIX}`);

  // Telegram 使用独立 fallback 组，成员是具体节点（按国家优先级展开），不引用竞速组。
  // fallback 语义：第一个健康节点持续使用，仅在该节点不可用时才切换到下一个——不会像 url-test 那样周期性换节点，
  // 避免 MTProto 长连接被周期性测速切换打断。WSL2 mihomo 与 iOS Stash 共用此配置，Telegram 掉线影响大，稳定性优先。
  const telegramPreferredCountries = [
    "香港",
    "日本",
    "美国",
    "加拿大",
    "英国",
    "德国",
    "法国",
    "澳大利亚",
    "韩国",
  ];
  const telegramProxies = [
    ...telegramPreferredCountries
      .filter((country) => countryNodes[country]?.length)
      .flatMap((country) =>
        countryNodes[country].map((node) => node.name).filter(isNotNull),
      ),
    PROXY_GROUPS.FALLBACK,
  ];

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
    {
      name: PROXY_GROUPS.FALLBACK,
      icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
      type: "fallback",
      url: SPEEDTEST_URL,
      proxies: [
        ...defaultFallback.filter((p) => p !== `香港${NODE_SUFFIX}`),
        ...(hasBkup ? [PROXY_GROUPS.BKUP] : []),
      ],
      interval: 60,
      tolerance: 20,
      lazy: true,
    },
    // 5. AI服务：默认使用列表末尾的 AI故障转移，也保留按国家手动选择
    {
      name: PROXY_GROUPS.AI_SERVICE,
      icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png`,
      type: "select",
      proxies: [PROXY_GROUPS.AI_FALLBACK, ...aiProxies],
    },
    // 6. Telegram：独立 fallback 组。成员为具体节点（按国家优先级展开），
    //    fallback 语义：首个健康节点持续使用，节点失效才切换下一个，避免 url-test 周期性换节点打断 MTProto 长连接。
    {
      name: PROXY_GROUPS.TELEGRAM,
      icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Telegram.png`,
      type: "fallback",
      url: SPEEDTEST_URL,
      interval: 60,
      tolerance: 20,
      lazy: true,
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
    // 10. 谷歌服务
    {
      name: PROXY_GROUPS.GOOGLE,
      icon: `${CDN_URL}/gh/Orz-3/mini@master/Color/Google.png`,
      type: "select",
      proxies: defaultProxies,
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
      proxies:
        hasTW && hasHK
          ? ["DIRECT", `台湾节点`, `香港节点`]
          : defaultProxiesDirect,
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
            ...(meta.excludePattern
              ? { "exclude-filter": meta.excludePattern }
              : {}),
          }
        : {
            proxies: countryNodes[country]
              ?.map((n) => n.name)
              .filter(isNotNull),
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
                proxies: lowCostNodes
                  .map((node) => node.name)
                  .filter(isNotNull),
              }
            : {
                "include-all": true as const,
                filter: LOW_COST_NODE_MATCHER.pattern,
              },
        })
      : null,
    // 15b. 备用节点 (conditional, url-test)
    bkupNodes.length > 0
      ? {
          name: PROXY_GROUPS.BKUP,
          icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
          type: "url-test",
          url: SPEEDTEST_URL,
          interval: 60,
          tolerance: 20,
          lazy: true,
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
    // AI故障转移固定放在所有策略组最后；美国优先，bkup 仅作最终兜底。
    {
      name: PROXY_GROUPS.AI_FALLBACK,
      icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png`,
      type: "fallback",
      url: SPEEDTEST_URL,
      proxies: [...aiProxies, ...(hasBkup ? [PROXY_GROUPS.BKUP] : [])],
      interval: 60,
      tolerance: 20,
      lazy: true,
    },
  ];

  return groups.filter(isNotNull);
}

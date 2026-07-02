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
    const groups: Array<ProxyGroup | null> = [
        // 1. 选择代理
        {
            name: PROXY_GROUPS.SELECT,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Proxy.png`,
            type: "select",
            proxies: defaultSelector,
        },
        // 2. 手动选择
        {
            name: PROXY_GROUPS.MANUAL,
            icon: `${CDN_URL}/gh/shindgewongxj/WHATSINStash@master/icon/select.png`,
            "include-all": true,
            type: "select",
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
        },
        // 4. 故障转移
        {
            name: PROXY_GROUPS.FALLBACK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
            type: "fallback",
            url: SPEEDTEST_URL,
            proxies: defaultFallback,
            interval: 60,
            tolerance: 20,
        },
        // 5. AI服务
        {
            name: PROXY_GROUPS.AI_SERVICE,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 6. 前置代理 (conditional)
        landing
            ? {
                  name: PROXY_GROUPS.FRONT_PROXY,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Area.png`,
                  type: "select",
                  proxies: frontProxySelector,
              }
            : null,
        // 7. 落地节点 (conditional)
        landing
            ? {
                  name: PROXY_GROUPS.LANDING,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Airport.png`,
                  type: "select",
                  proxies: landingNodes.map((node) => node.name).filter(isNotNull),
              }
            : null,
        // 8. 静态资源
        {
            name: PROXY_GROUPS.STATIC_RESOURCES,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Cloudflare.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 9. 谷歌服务
        {
            name: PROXY_GROUPS.GOOGLE,
            icon: `${CDN_URL}/gh/Orz-3/mini@master/Color/Google.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 10. 微软服务
        {
            name: PROXY_GROUPS.MICROSOFT,
            icon: `${CDN_URL}/gh/powerfullz/override-rules@master/icons/Microsoft_Copilot.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 11. 哔哩哔哩
        {
            name: PROXY_GROUPS.BILIBILI,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/bilibili.png`,
            type: "select",
            proxies: hasTW && hasHK ? ["DIRECT", `台湾节点`, `香港节点`] : defaultProxiesDirect,
        },
        // 12. Xbox
        {
            name: PROXY_GROUPS.XBOX,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Xbox.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 13. Github
        {
            name: PROXY_GROUPS.GITHUB,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/GitHub.png`,
            type: "select",
            proxies: defaultProxies,
        },
        // 14. Video
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
                : { proxies: countryNodes[country]?.map((n) => n.name).filter(isNotNull) };
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
                      ? { proxies: lowCostNodes.map((node) => node.name).filter(isNotNull) }
                      : { "include-all": true as const, filter: LOW_COST_NODE_MATCHER.pattern },
              })
            : null,
        // 15b. 备用节点 (conditional)
        bkupNodes.length > 0
            ? {
                  name: PROXY_GROUPS.BKUP,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
                  type: "select",
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
    ];

    return groups.filter(isNotNull);
}

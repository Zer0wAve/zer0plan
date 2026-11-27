/**
 * 节点级出口风险标记（单一权威名单）。
 *
 * 「已知送中」= 实测出口被 Google 判为中国大陆（如 Gemini 返回
 * LOCATION_NOT_ELIGIBLE / detected_location: CN）的节点。这类节点对 Google 与
 * AI 服务不可用，但普通上网仍可用，因此**不删除节点、不改名**（改名会破坏
 * 客户端已保存的选择缓存），只在 AI服务 / 谷歌服务 的成员构造时排除。
 *
 * 规则：只登记有实测证据的节点，精确匹配名称；不得按地区、倍率、运营商
 * 或同批节点泛化推断。新增证据时把节点名追加到本数组，AI 与 Google
 * 两个入口会同时生效。
 */
export const KNOWN_GEOIP_CN_NODES: readonly string[] = [
    // 2026-11-27：Gemini/aicode 报 LOCATION_NOT_ELIGIBLE、detected_location=CN。
    "LXY-🇺🇸美国01|流媒体|0.1x",
    "LXY-🇺🇸美国洛杉矶01|流媒体|0.01x",
    // 2026-11-27 隔离串行实测：notebooklm 返回 location=unsupported，且 google.com/searchdomaincheck 跳转 hkredirect（或 000）。
    "LXY-🇺🇸美国洛杉矶02|流媒体|0.01x",
    "LXY-🇺🇸美国02|流媒体|0.1x",
    "LXY-🇺🇸美国03|流媒体|0.1x",
    "LXY-🇺🇸美国04|流媒体|0.1x",
    "LXY-🇺🇸美国05|流媒体|0.1x",
    "LXY-🇸🇬新加坡高速02|BGP|CTCUCM",
    "LXY-🇸🇬新加坡高速04|BGP|CTCUCM",
    "LXY-🇬🇧英国伦敦01|流媒体|0.1x",
];

/**
 * 实测对 Google/AI 干净且可用的优先节点（2026-11-27 实测 notebooklm 301->notebook.google.com、
 * searchdomaincheck 200=.google.com，且 agy-cli/gemini-4-neon 实测 200 正常出文）。
 * 在 AI故障转移 / Google故障转移 中置顶，避免 fallback 先落到未测或死节点上。
 */
export const AI_GOOGLE_VERIFIED_PREFERRED_NODES: readonly string[] = [
    "LXY-🇸🇬新加坡专线01|BGP|流媒体",
    "LXY-🇯🇵日本专线01|BGP|流媒体",
];

const KNOWN_GEOIP_CN_SET = new Set(KNOWN_GEOIP_CN_NODES.map((name) => name.trim()));

/** 是否为已知送中节点（AI / Google 不可用）。 */
export function isKnownGeoipCnNode(name?: string | null): boolean {
    return Boolean(name && KNOWN_GEOIP_CN_SET.has(name.trim()));
}

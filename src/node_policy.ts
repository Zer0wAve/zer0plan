/**
 * 节点级 AI/Google 出口风险登记（单一权威名单）。
 *
 * 两类风险必须分开记，不能都写成「送中」：
 *
 * 1. `geoip-cn-confirmed`：实测出口被 Google 判为中国大陆
 *    （aicode.googleapis.com 返回 LOCATION_NOT_ELIGIBLE / `Detected location: CN`），
 *    且有实际链路（mihomo 选中节点）或日志关联到该节点。这是地理事实。
 * 2. `ai-google-symptom-precaution`：没有拿到 CN 判定，只有产品侧旁证
 *    （NotebookLM `location=unsupported`、google.com/searchdomaincheck 302 到
 *    hkredirect、连接超时）。它只证明该出口对 AI/Google 不可用或不可信，
 *    **不能**据此推断出口在中国大陆。
 *
 * 两类都从 AI服务 / 谷歌服务 排除（fail closed：宁可少一个候选，也不落回坏出口），
 * 所以排除行为不因标签纠正而改变。但证据等级不得混写：新增条目必须按实际证据
 * 归入对应 risk，禁止按地区、倍率、运营商或同批节点推断。节点仍保留在 proxies
 * 与普通组里，不删除、不改名（改名会破坏客户端已保存的选择缓存）。
 */
export type AiGoogleNodeRisk = "geoip-cn-confirmed" | "ai-google-symptom-precaution";

export interface AiGoogleExcludedNode {
    name: string;
    risk: AiGoogleNodeRisk;
    evidence: string;
}

export const AI_GOOGLE_EXCLUDED_NODES: readonly AiGoogleExcludedNode[] = [
    {
        name: "LXY-🇺🇸美国01|流媒体|0.1x",
        risk: "geoip-cn-confirmed",
        evidence:
            "2026-11-27 aicode.googleapis.com 返回 LOCATION_NOT_ELIGIBLE + Detected location: CN；mihomo 实际链路命中本节点",
    },
    {
        name: "LXY-🇺🇸美国洛杉矶01|流媒体|0.01x",
        risk: "geoip-cn-confirmed",
        evidence:
            "2026-11-27 AI故障转移 落到本节点后 aicode 复现 Detected location: CN（路由/日志关联）",
    },
    // 以下 8 个只有产品侧旁证：notebooklm location=unsupported、searchdomaincheck
    // 跳 hkredirect（或 000）、超时。没有 CN 判定，按 precaution 排除。
    {
        name: "LXY-🇺🇸美国洛杉矶02|流媒体|0.01x",
        risk: "ai-google-symptom-precaution",
        evidence: "notebooklm location=unsupported；searchdomaincheck hkredirect/000",
    },
    {
        name: "LXY-🇺🇸美国02|流媒体|0.1x",
        risk: "ai-google-symptom-precaution",
        evidence: "notebooklm location=unsupported；searchdomaincheck hkredirect",
    },
    {
        name: "LXY-🇺🇸美国03|流媒体|0.1x",
        risk: "ai-google-symptom-precaution",
        evidence: "notebooklm location=unsupported；searchdomaincheck hkredirect",
    },
    {
        name: "LXY-🇺🇸美国04|流媒体|0.1x",
        risk: "ai-google-symptom-precaution",
        evidence: "notebooklm location=unsupported；searchdomaincheck hkredirect",
    },
    {
        name: "LXY-🇺🇸美国05|流媒体|0.1x",
        risk: "ai-google-symptom-precaution",
        evidence: "notebooklm location=unsupported；searchdomaincheck hkredirect",
    },
    {
        name: "LXY-🇸🇬新加坡高速02|BGP|CTCUCM",
        risk: "ai-google-symptom-precaution",
        evidence: "notebooklm location=unsupported；searchdomaincheck hkredirect/超时",
    },
    {
        name: "LXY-🇸🇬新加坡高速04|BGP|CTCUCM",
        risk: "ai-google-symptom-precaution",
        evidence: "notebooklm location=unsupported；searchdomaincheck hkredirect/超时",
    },
    {
        name: "LXY-🇬🇧英国伦敦01|流媒体|0.1x",
        risk: "ai-google-symptom-precaution",
        evidence: "notebooklm location=unsupported；searchdomaincheck hkredirect/000",
    },
];

/** 实测确证出口为中国大陆的节点（有 aicode CN 判定 + 链路关联）。 */
export const GEOIP_CN_CONFIRMED_NODES: readonly string[] = AI_GOOGLE_EXCLUDED_NODES.filter(
    (node) => node.risk === "geoip-cn-confirmed"
).map((node) => node.name);

/** 仅凭产品侧旁证排除的节点（未确证 CN，不得对外称「送中」）。 */
export const AI_GOOGLE_SYMPTOM_PRECAUTION_NODES: readonly string[] =
    AI_GOOGLE_EXCLUDED_NODES.filter(
        (node) => node.risk === "ai-google-symptom-precaution"
    ).map((node) => node.name);

/**
 * 优先节点及其验证等级。排序即故障转移顺序，先 SG 后 JP（保持原顺序）。
 *
 * - `real-model-verified`：真实模型/登录态下出文成功，可作 AI 首选。
 * - `anonymous-web-probe-only`：只做过匿名网页探测（重定向/状态码），
 *   未验证模型出文；放在池里可用，但不得与前者同等称为「实测干净」。
 */
export type AiGoogleVerification = "real-model-verified" | "anonymous-web-probe-only";

export interface AiGooglePreferredNode {
    name: string;
    verification: AiGoogleVerification;
    evidence: string;
}

export const AI_GOOGLE_PREFERRED_NODES: readonly AiGooglePreferredNode[] = [
    {
        name: "LXY-🇸🇬新加坡专线01|BGP|流媒体",
        verification: "real-model-verified",
        evidence:
            "2026-11-27 NAS 自动故障转移下 agy-cli/gemini-4-neon HTTP 200 正常出文；notebooklm 301→notebook.google.com、searchdomaincheck 200=.google.com",
    },
    {
        name: "LXY-🇯🇵日本专线01|BGP|流媒体",
        verification: "anonymous-web-probe-only",
        evidence:
            "2026-11-27 仅匿名网页探测（notebooklm 重定向、searchdomaincheck 200）；未做真实模型出文验证",
    },
];

/** 优先节点名称，顺序即 AI故障转移 / Google故障转移 的置顶顺序。 */
export const AI_GOOGLE_PREFERRED_NODE_NAMES: readonly string[] = AI_GOOGLE_PREFERRED_NODES.map(
    (node) => node.name
);

const EXCLUDED_SET = new Set(AI_GOOGLE_EXCLUDED_NODES.map((node) => node.name.trim()));

/** 是否为已登记风险节点（AI / Google 排除；不等于已确证送中）。 */
export function isAiGoogleExcludedNode(name?: string | null): boolean {
    return Boolean(name && EXCLUDED_SET.has(name.trim()));
}

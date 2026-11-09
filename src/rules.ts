import { NODE_SUFFIX, PROXY_GROUPS } from "./constants";

/** acgrip 按出口地区拦截：日本/英国/德国出口整站 403，港/台/新/美实测均 200。
 *  这里按优先级挑一个「地区组已生成」的国家，避免引用不存在的组导致配置致命错误。
 *  注意 countryNames 是裸国家名（如「香港」），组名要自己补 NODE_SUFFIX。 */
const ACGRIP_COUNTRIES = ["香港", "台湾", "新加坡", "美国"];

const baseRules = (acgripGroup: string | undefined): string[] => [
    // acgrip 直连 5–35s 常超时，必须走代理；但它不能共用 zer0proxy 的目标组：
    // 那是 选择代理，Windows 上前者默认指向 低倍率节点（url-test，含日本实验性节点），
    // 竞速到日本出口就整站 403（实测日本节点根域/forum.php/帖子页全 403，
    // 而同节点访问 example.com/cloudflare.com/discord.com 均 200）。
    ...(acgripGroup ? [`DOMAIN-SUFFIX,acgrip.com,${acgripGroup}`] : []),
    // Explicit proxy exceptions take precedence over broad direct domains.
    `RULE-SET,zer0proxy,${PROXY_GROUPS.SELECT}`,
    // 叮咚买菜（上海壹佰米网络科技，证书 *.ddxq.mobi / *.100.me 已核）内联直连。
    // 为什么不只写进 zer0direct.yaml：那是 http provider，interval=86400，客户端
    // 拉到一次就缓存 24 小时；手机 Stash 更新订阅也不会重下 ruleset，
    // 导致「规则改了但手机不生效」。内联进主配置则每次订阅更新都跟着下发。
    // 国内 CDN（华为云/自建 elb），fake-ip 下 GEOIP,cn 判不出会落 Final 走代理→用不了。
    `DOMAIN-SUFFIX,ddxq.mobi,DIRECT`,
    `DOMAIN-SUFFIX,ddimg.mobi,DIRECT`,
    `DOMAIN-SUFFIX,100.me,DIRECT`,
    `RULE-SET,zer0direct,DIRECT`,
    `RULE-SET,ADBlock,${PROXY_GROUPS.AD_BLOCK}`,
    `RULE-SET,AdditionalFilter,${PROXY_GROUPS.AD_BLOCK}`,
    `RULE-SET,StaticResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    `RULE-SET,CDNResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    `RULE-SET,AdditionalCDNResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    // Hand-added AI domains that GEOSITE,category-ai-!cn does not carry yet.
    // Remove once upstream geosite includes them.
    `DOMAIN-SUFFIX,opencode.ai,${PROXY_GROUPS.AI_SERVICE}`,
    `DOMAIN-SUFFIX,muse.ai,${PROXY_GROUPS.AI_SERVICE}`,
    `GEOSITE,category-ai-!cn,${PROXY_GROUPS.AI_SERVICE}`,
    `RULE-SET,BiliIntl,${PROXY_GROUPS.BILIBILI}`,
    `GEOSITE,youtube,${PROXY_GROUPS.VIDEO}`,
    `GEOSITE,telegram,${PROXY_GROUPS.TELEGRAM}`,
    `GEOIP,telegram,${PROXY_GROUPS.TELEGRAM},no-resolve`,
    `GEOSITE,xbox,${PROXY_GROUPS.XBOX}`,
    `GEOSITE,github,${PROXY_GROUPS.GITHUB}`,
    `GEOSITE,netflix,${PROXY_GROUPS.VIDEO}`,
    `GEOSITE,twitch,${PROXY_GROUPS.VIDEO}`,
    `GEOIP,netflix,${PROXY_GROUPS.VIDEO},no-resolve`,
    `GEOSITE,bahamut,${PROXY_GROUPS.VIDEO}`,
    `GEOSITE,pikpak,${PROXY_GROUPS.VIDEO}`,
    `GEOSITE,twitter,${PROXY_GROUPS.SELECT}`,
    `RULE-SET,EHentai,${PROXY_GROUPS.EHENTAI}`,
    `RULE-SET,TikTok,${PROXY_GROUPS.VIDEO}`,
    `RULE-SET,SteamFix,DIRECT`,
    `GEOSITE,steam@cn,DIRECT`,
    `RULE-SET,GoogleFCM,DIRECT`,
    `GEOSITE,google-play@cn,DIRECT`,
    `GEOSITE,microsoft@cn,DIRECT`,
    `GEOSITE,microsoft,${PROXY_GROUPS.MICROSOFT}`,
    `GEOSITE,google,${PROXY_GROUPS.GOOGLE}`,
    `RULE-SET,Crypto,${PROXY_GROUPS.SELECT}`,
    `RULE-SET,GFWList,${PROXY_GROUPS.SELECT}`,
    `GEOIP,private,DIRECT,no-resolve`,
    // 注意：GEOIP,cn 不能带 no-resolve。系统代理模式下客户端只给域名、不给 IP，
    // no-resolve 会让该域名根本没有 IP 可比 → 规则被跳过 → 国内域名落到 MATCH,Final 走代理。
    `GEOIP,cn,DIRECT`,
    `MATCH,${PROXY_GROUPS.FINAL}`,
];

const processDirectRules = [
    "PROCESS-NAME,v2ray,DIRECT",
    "PROCESS-NAME,Surge,DIRECT",
    "PROCESS-NAME,ss-local,DIRECT",
    "PROCESS-NAME,privoxy,DIRECT",
    "PROCESS-NAME,trojan,DIRECT",
    "PROCESS-NAME,trojan-go,DIRECT",
    "PROCESS-NAME,naive,DIRECT",
    "PROCESS-NAME,CloudflareWARP,DIRECT",
    "PROCESS-NAME,Cloudflare WARP,DIRECT",
    "PROCESS-NAME,p4pclient,DIRECT",
    "PROCESS-NAME,qbittorrent,DIRECT",
    "PROCESS-NAME,Transmission,DIRECT",
    "PROCESS-NAME,aria2c,DIRECT",
    "PROCESS-NAME,fdm,DIRECT",
    "PROCESS-NAME,uTorrent,DIRECT",
    "PROCESS-NAME,WebTorrent,DIRECT",
    "PROCESS-NAME,Thunder,DIRECT",
    "PROCESS-NAME,DownloadService,DIRECT",
];

/**
 * 构建最终的规则列表。
 *
 * @param {Object} params - 构建参数
 * @param {boolean} params.processRulesEnabled - 是否加入桌面端进程直连规则
 * @param {string[]} params.countryNames - 实际生成的地区节点组（用于判断 acgrip 该钉哪个组）
 * @returns {string[]} 规则字符串数组
 */
export function buildRules({
    processRulesEnabled,
    countryNames,
}: {
    processRulesEnabled: boolean;
    countryNames: string[];
}): string[] {
    const acgripCountry = ACGRIP_COUNTRIES.find((c) => countryNames.includes(c));
    // 没有任何可用的港/台/新/美地区组时，不生成 acgrip 规则（宁可走 zer0proxy 的口子，
    // 也不要引用一个不存在的组把整份配置打成致命错误）。
    const rules = baseRules(acgripCountry ? `${acgripCountry}${NODE_SUFFIX}` : undefined);

    // QUIC 不再屏蔽（2026-11-04 用户要求删除）。历史上这里会在规则最前面插入
    // `AND,((DST-PORT,443),(NETWORK,UDP)),REJECT`，把 UDP/443 全拒掉强制回落 TCP，
    // 换取「行为确定」；代价是 QUIC 能通时的那部分提速全丢，而 hysteria2 这类
    // UDP 代理本身就要走 UDP。现在直接放行，由节点自己协商。
    return processRulesEnabled ? [...processDirectRules, ...rules] : rules;
}

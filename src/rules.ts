import { PROXY_GROUPS } from "./constants";

const baseRules = [
    `RULE-SET,zer0direct,DIRECT`,
    `RULE-SET,zer0proxy,${PROXY_GROUPS.SELECT}`,
    `RULE-SET,ADBlock,${PROXY_GROUPS.AD_BLOCK}`,
    `RULE-SET,AdditionalFilter,${PROXY_GROUPS.AD_BLOCK}`,
    `RULE-SET,StaticResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    `RULE-SET,CDNResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    `RULE-SET,AdditionalCDNResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    `GEOSITE,category-ai-!cn,${PROXY_GROUPS.AI_SERVICE}`,
    `RULE-SET,BiliIntl,${PROXY_GROUPS.BILIBILI}`,
    `GEOSITE,youtube,${PROXY_GROUPS.VIDEO}`,
    `GEOSITE,telegram,${PROXY_GROUPS.FALLBACK}`,
    `GEOIP,telegram,${PROXY_GROUPS.FALLBACK},no-resolve`,
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
    `RULE-SET,GoogleFCM,DIRECT`,
    `GEOSITE,google-play@cn,DIRECT`,
    `GEOSITE,microsoft@cn,DIRECT`,
    `GEOSITE,microsoft,${PROXY_GROUPS.MICROSOFT}`,
    `GEOSITE,google,${PROXY_GROUPS.GOOGLE}`,
    `RULE-SET,Crypto,${PROXY_GROUPS.SELECT}`,
    `RULE-SET,GFWList,${PROXY_GROUPS.SELECT}`,
    `GEOIP,private,DIRECT,no-resolve`,
    `GEOIP,cn,DIRECT`,
    `MATCH,${PROXY_GROUPS.FINAL}`,
];

/**
 * 构建最终的规则列表。
 *
 * @param {Object} params - 构建参数
 * @param {boolean} params.quicEnabled - 是否启用 QUIC（如未启用会插入 UDP:443 拦截规则）
 * @returns {string[]} 规则字符串数组
 */
export function buildRules({ quicEnabled }: { quicEnabled: boolean }): string[] {
    const ruleList = [...baseRules];
    // 进程直连规则（防代理环路 + 下载工具直连，桌面 mihomo 生效）
    ruleList.unshift(
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
    );
    return ruleList;
}

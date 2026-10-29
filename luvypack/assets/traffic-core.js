(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TradeTraffic=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const contextFields=['category_id','product_family_id','style_id','page_variant','scenario_id','content_theme'];
  const events={
    contact_click:'点击联系入口；不等于发送或收到消息',
    scenario_select:'选择场景入口；不证明采购意图',
    comparison_select:'点击同用途产品比较链接；不等于目标页加载或询盘',
    spec_open:'主动打开规格说明；不等于认同质量',
    customization_start:'进入定制说明或操作；不等于提交需求',
    catalog_click:'点击资料下载入口；不等于下载完成',
    inquiry_start:'开始与询盘表单交互；不等于提交或收件'
  };
  const methods=['email','whatsapp','form'];
  const placements=['header','floating','content','product','footer','dialog'];
  const motivations=['functional','experiential','mixed','unknown'];
  const audiences=['business','personal','shared','unknown'];
  const knownReferrers={
    'google.com':['google','search'],'google.co.uk':['google','search'],
    'google.ca':['google','search'],'google.de':['google','search'],
    'google.fr':['google','search'],'google.com.au':['google','search'],
    'bing.com':['bing','search'],'pinterest.com':['pinterest','social'],
    'linkedin.com':['linkedin','social'],'youtube.com':['youtube','video'],'github.com':['github','referral'],
    'henwanla.github.io':['github','referral'],
    'chatgpt.com':['chatgpt','ai'],'perplexity.ai':['perplexity','ai'],
    'copilot.microsoft.com':['copilot','ai'], 'claude.ai':['claude','ai'],
    'gemini.google.com':['gemini','ai']
  };
  function object(v,label){if(!v||typeof v!=='object'||Array.isArray(v))throw Error(label+' 应为对象');}
  function fields(v,allowed,label){object(v,label);for(const k of Object.keys(v))if(!allowed.includes(k))throw Error(label+' 未支持字段：'+k);}
  function slug(v,label){if(typeof v!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(v))throw Error(label+' 请使用最多64位小写字母、数字、短横线或下划线');return v;}
  function label(v,name){if(typeof v!=='string'||!v.trim())throw Error(name+' 不能为空');}
  function http(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;return u;}catch{return null;}}
  function unique(rows,key,name){if(new Set(rows.map(x=>x[key])).size!==rows.length)throw Error(name+' 重复');}
  function validate(config){
    fields(config,['version','site_id','label','origin','pages','campaigns'],'站点');
    if(config.version!==1)throw Error('不支持的配置版本');
    slug(config.site_id,'site_id');label(config.label,'站点名称');
    const origin=http(config.origin);
    if(!origin||origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.origin!==config.origin)throw Error('origin 应为不带末尾斜线的 HTTPS 主机地址');
    if(!Array.isArray(config.pages)||!config.pages.length)throw Error('至少登记一个页面');
    if(!Array.isArray(config.campaigns))throw Error('campaigns 应为数组');
    for(const p of config.pages){
      fields(p,['id','label','path','motivation_route','audience_path',...contextFields],'页面');
      slug(p.id,'页面编号');label(p.label,'页面名称');
      const u=typeof p.path==='string'?http(config.origin+p.path):null;
      if(!u||!p.path.startsWith('/')||p.path.startsWith('//')||u.origin!==origin.origin||u.pathname!==p.path||u.search||u.hash)throw Error('页面路径须为已规范化的站内路径，不含参数或片段');
      if(!motivations.includes(p.motivation_route)||!audiences.includes(p.audience_path))throw Error('页面动机路线或受众入口无效');
      for(const k of contextFields)if(p[k]!==undefined)slug(p[k],k);
    }
    unique(config.pages,'id','页面编号');unique(config.pages,'path','页面路径');
    for(const c of config.campaigns){
      fields(c,['id','label','page_id','source','medium','campaign','content'],'发布记录');
      label(c.label,'发布名称');for(const k of ['id','page_id','source','medium','content'])slug(c[k],k);
      if(c.campaign!==undefined)slug(c.campaign,'campaign');
      if(!config.pages.some(p=>p.id===c.page_id))throw Error('发布记录指向未登记页面');
    }
    unique(config.campaigns,'id','发布编号');
    const signatures=config.campaigns.map(c=>JSON.stringify([page(config,c.page_id).path,c.source,c.medium,c.campaign??c.id,c.content]));
    if(new Set(signatures).size!==signatures.length)throw Error('发布记录生成了相同链接，无法区分；请合并记录或使用不同内容标记');
    return config;
  }
  function page(config,id){const p=config.pages.find(p=>p.id===id);if(!p)throw Error('未登记的页面');return p;}
  function campaignURL(config,id){
    validate(config);const c=config.campaigns.find(c=>c.id===id);if(!c)throw Error('未登记的发布记录');
    const u=new URL(page(config,c.page_id).path,config.origin);
    for(const [k,v] of Object.entries({utm_source:c.source,utm_medium:c.medium,utm_campaign:c.campaign??c.id,utm_content:c.content}))u.searchParams.set(k,v);
    return u.href;
  }
  function pageAt(config,url){
    const u=http(url);if(!u||u.origin!==config.origin)return null;
    return config.pages.find(p=>p.path===u.pathname)||null;
  }
  function referrerSignal(config,value){
    const r=http(value);
    if(!r)return {source:'unknown',medium:'unknown',evidence:'absent_or_invalid'};
    if(r.origin===config.origin)return {source:'unknown',medium:'unknown',evidence:'internal_navigation'};
    const known=knownReferrers[r.hostname.toLowerCase().replace(/^www\./,'')];
    return known?{source:known[0],medium:known[1],evidence:'referrer_origin'}:{source:'unknown',medium:'unknown',evidence:'other_external_referrer'};
  }
  function arrival(config,url,referrer=''){
    validate(config);const u=http(url),p=pageAt(config,url);
    if(!u||!p)throw Error('请使用本项目已登记页面的网址');
    const ref=referrerSignal(config,referrer);
    const base={page_id:p.id,source:'unknown',medium:'unknown',campaign:'unknown',record_id:'unknown',content:'unknown',evidence:'unknown',referrer_signal:ref,meaning:'浏览器未提供可用的外部来源；不能据此认定为手动输入。'};
    const keys=['utm_source','utm_medium','utm_campaign','utm_content'];
    if(keys.some(k=>u.searchParams.has(k))){
      if(keys.some(k=>u.searchParams.getAll(k).length!==1))return {...base,evidence:'incomplete_or_duplicate_tags',meaning:'来源标记缺失或重复；未将它归入已登记发布。'};
      const c=config.campaigns.find(c=>(c.campaign??c.id)===u.searchParams.get('utm_campaign')&&c.page_id===p.id&&c.source===u.searchParams.get('utm_source')&&c.medium===u.searchParams.get('utm_medium')&&c.content===u.searchParams.get('utm_content'));
      if(c)return {...base,source:c.source,medium:c.medium,campaign:c.campaign??c.id,record_id:c.id,content:c.content,evidence:'registered_url_labels',signals_differ:ref.source!=='unknown'&&ref.source!==c.source,meaning:'网址标记与发布登记一致；标签仍可能被复制，不能证明用户身份或原始点击地点。引荐域线索另列，不被标签覆盖。'};
      return {...base,evidence:'unregistered_tags',meaning:'存在来源参数，但与本项目登记不一致；保留为待核，不回传原始参数。'};
    }
    if(ref.evidence==='absent_or_invalid')return base;
    if(ref.evidence==='internal_navigation')return {...base,evidence:'internal_navigation',meaning:'观察到站内跳转。此工具不重算会话来源，也不把站内页面视为获客渠道。'};
    if(ref.evidence==='referrer_origin')return {...base,source:ref.source,medium:ref.medium,evidence:'referrer_origin',meaning:'仅识别来源域名；没有确定文章、搜索词、AI问题或具体用户。'};
    return {...base,evidence:'other_external_referrer',meaning:'存在其他外部引荐；未分类，不输出完整来源路径或参数。'};
  }
  function event(config,pageId,name,details={}){
    validate(config);const p=page(config,pageId);
    if(!Object.hasOwn(events,name))throw Error('未支持的事件；本工具不生成收件、成交或付款事件');
    const allowed=name==='contact_click'?['contact_method','cta_location']:['scenario_select','comparison_select'].includes(name)?['target_page_id']:[];
    fields(details,allowed,'事件');
    const extra={};
    if(name==='contact_click'){
      if(!methods.includes(details.contact_method)||!placements.includes(details.cta_location))throw Error('联系方法或位置无效');
      Object.assign(extra,details);
    }
    if(['scenario_select','comparison_select'].includes(name)){page(config,details.target_page_id);extra.target_page_id=details.target_page_id;}
    const params={site_id:config.site_id,page_id:p.id,motivation_route:p.motivation_route,audience_path:p.audience_path};
    for(const k of contextFields)if(p[k]!==undefined)params[k]=p[k];
    // The adapter supplies these for its custom events only. Existing tags need a separate PII review.
    return {name,params:{...params,...extra,page_location:config.origin+p.path,page_referrer:''}};
  }
  function escapeMD(value){return String(value).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])).replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');}
  function report(config){
    validate(config);
    const lines=['# '+escapeMD(config.label)+'：来源与事件计划','','这是配置与演示资料，不是线上流量报告。页面路线表示内容假设，不代表访客身份或情绪。','',
      '| 页面 | 受众入口 | 动机路线 | 场景 |','|---|---|---|---|'];
    for(const p of config.pages)lines.push('| '+[p.label,p.audience_path,p.motivation_route,p.scenario_id||'unknown'].map(escapeMD).join(' | ')+' |');
    lines.push('','## 外部发布链接','','仅用于站外发布；站内导航使用干净链接。登记名称不证明平台已发布、索引或引流。');
    for(const c of config.campaigns)lines.push('','- '+escapeMD(c.label),'  记录：'+escapeMD(c.id)+'；活动：'+escapeMD(c.campaign??c.id)+'；内容：'+escapeMD(c.content),'  '+campaignURL(config,c.id));
    lines.push('','## 可记录的行为','');
    for(const [k,v] of Object.entries(events))lines.push('- '+k+'：'+v);
    lines.push('','## 接入前核对','','网站原生统计标签与同意机制由实际项目接入。只安装一套相同事件，检查自动外链采集是否上传了联系链接中的个人信息。','来源缺失保留未知；自然搜索词与AI引用使用对应平台的聚合报告，不与每次访问强行匹配。','实际收到、有效询盘和订单需另有业务记录；本工具不要求运营方承担跟单。');
    return lines.join('\n')+'\n';
  }
  return {events,methods,placements,motivations,audiences,validate,campaignURL,pageAt,arrival,event,report};
});

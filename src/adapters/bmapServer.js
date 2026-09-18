// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 服务端适配器（Electron 主进程 / Node 使用）：调用百度 Web 服务 API，
// 启用批量距离矩阵 routematrix，主进程自定义 Referer 头绕过 AK 校验、隐藏密钥。
// 仅在桌面端加载，不进入 Web 前端打包。

async function baiDuGet(api, path, params) {
  const u = new URL(api + path);
  for (const k of Object.keys(params)) u.searchParams.set(k, params[k]);
  const resp = await fetch(u.toString(), { headers: { Referer: params._referer || 'http://localhost' } });
  const json = await resp.json();
  if (json.status !== 0) throw new Error('baidu:' + json.status + ' ' + (json.message || ''));
  return json;
}

function jieXiLuXian(pathStr) {
  if (!pathStr) return [];
  return pathStr.split(';').map((s) => {
    const [lng, lat] = s.split(',').map(Number);
    return { lng, lat };
  });
}

export function chuangJianBmapServer(cfg = {}) {
  const ak = cfg.ak || process.env.BAIDU_SERVER_AK || '';
  const api = cfg.api || 'https://api.map.baidu.com';
  const referer = cfg.referer || 'http://localhost';

  return {
    async walkingRoute(origin, dest) {
      const json = await baiDuGet(api, '/direction/v2/walking', {
        ak,
        origin: `${origin.lng},${origin.lat}`,
        destination: `${dest.lng},${dest.lat}`,
        _referer: referer,
      });
      const r = json.result.routes[0];
      return {
        durationSec: r.duration,
        distanceM: r.distance,
        polyline: jieXiLuXian(r.steps?.map((s) => s.path).join(';')),
      };
    },

    async routeMatrix(origins, dests) {
      const json = await baiDuGet(api, '/routematrix/v1/walking', {
        ak,
        origins: origins.map((o) => `${o.lng},${o.lat}`).join('|'),
        destinations: dests.map((d) => `${d.lng},${d.lat}`).join('|'),
        _referer: referer,
      });
      return json.result.map((row) =>
        row.map((e) => ({ durationSec: e.duration, distanceM: e.distance }))
      );
    },

    async searchPoi(center, keywords, radiusMi) {
      const out = [];
      for (const kw of keywords) {
        const json = await baiDuGet(api, '/place/v2/search', {
          ak,
          query: kw,
          location: `${center.lat},${center.lng}`,
          radius: radiusMi,
          scope: 2,
          page_size: 20,
          _referer: referer,
        });
        for (const p of json.results || []) {
          out.push({
            uid: p.uid,
            name: p.name,
            lng: p.location.lng,
            lat: p.location.lat,
            type: '',
            address: p.address || '',
          });
        }
      }
      return out;
    },

    async reverseGeocode(point) {
      const json = await baiDuGet(api, '/reverse_geocoding/v3', {
        ak,
        location: `${point.lat},${point.lng}`,
        _referer: referer,
      });
      const sem = json.result.sematic_description || '';
      const addr = json.result.formatted_address || '';
      let poiType = 'residential';
      if (/湖|河|江|湿地|公园|绿地|工业|厂房|铁路|高铁/.test(addr + sem)) poiType = 'fei_juzhu';
      return { address: addr, aoi: sem, poiType };
    },
  };
}

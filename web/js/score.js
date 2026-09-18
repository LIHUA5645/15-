// 作者：肖沐樑　QQ：3387432690
// 完成时间：2026，09，18
// 评分星级 / 进度条渲染 + 盲区清单渲染

function xingshi(xingji) {
  return '★★★★★'.slice(0, xingji) + '☆☆☆☆☆'.slice(0, 5 - xingji);
}

function xianshiPingfen(pf) {
  document.getElementById('zonghe').textContent = pf.zonghe;
  const box = document.getElementById('pingfen');
  box.innerHTML = '';
  (pf.xiangqing || []).forEach((x) => {
    const div = document.createElement('div');
    div.className = 'xiang';
    const bili = (x.xingji / 5 * 100) + '%';
    div.innerHTML = `<span class="ming">${x.ming}</span>` +
      `<span class="tiao"><i style="width:${bili}"></i></span>` +
      `<span class="xing">${xingshi(x.xingji)}（${x.shuliang}个）</span>`;
    box.appendChild(div);
  });
}

function xianshiMangqu(mangqu) {
  const ul = document.getElementById('mangquList');
  ul.innerHTML = '';
  if (!mangqu || !mangqu.length) {
    ul.innerHTML = '<li>未检测到服务盲区，配套较均衡。</li>';
    return;
  }
  mangqu.forEach((m) => {
    const li = document.createElement('li');
    li.textContent = `${m.fangwei} 方向约 ${m.fanwei_m}m 范围内缺失：${m.que_shao.join('、')}`;
    ul.appendChild(li);
  });
}

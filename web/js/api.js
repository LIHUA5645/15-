// 作者：肖沐樑　QQ：3387432690
// 完成时间：2026，09，18
// 后端接口调用封装

async function huoquPeizhi() {
  const r = await fetch('/api/config');
  return r.json();
}

async function tijian(canshu) {
  const r = await fetch('/api/tijian', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(canshu),
  });
  return r.json();
}

// 作者：肖沐樑　QQ：3387432690
// 完成时间：2026，09，18
// 用 ECharts 画各类设施数量柱状图

function huatZhuzhuang(pingfen) {
  const el = document.getElementById('bar');
  if (!window.echarts || !el) return;
  const xiang = pingfen.xiangqing || [];
  const tu = echarts.init(el);
  tu.setOption({
    title: { text: '圈内各类设施数量', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {},
    xAxis: { type: 'category', data: xiang.map((x) => x.ming) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{ type: 'bar', data: xiang.map((x) => x.shuliang),
               itemStyle: { color: '#1f6feb' } }],
  });
  window.addEventListener('resize', () => tu.resize());
}

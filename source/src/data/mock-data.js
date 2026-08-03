export const resources = [
  { id: "W", name: "白", value: 3, cap: 10, tone: "white" },
  { id: "U", name: "蓝", value: 1, cap: 10, tone: "blue" },
  { id: "B", name: "黑", value: 0, cap: 10, tone: "black" },
  { id: "R", name: "红", value: 0, cap: 10, tone: "red" },
  { id: "G", name: "绿", value: 2, cap: 10, tone: "green" },
  { id: "C", name: "无色", value: 1240, cap: 2000, tone: "colorless" },
];

export const navItems = [
  { id: "base", key: "1", label: "基地", icon: "⌂" },
  { id: "prototype", key: "2", label: "原体", icon: "◇" },
  { id: "biofactors", key: "3", label: "生物因子", icon: "◈" },
  { id: "artifacts", key: "4", label: "神器", icon: "⬡" },
  { id: "enchantments", key: "5", label: "结界", icon: "◉" },
  { id: "spells", key: "6", label: "法术", icon: "✦" },
  { id: "map", key: "7", label: "地图", icon: "⌘" },
  { id: "expedition", key: "8", label: "远征", icon: "↗" },
  { id: "logs", key: "9", label: "记录", icon: "≡" },
];

export const systemLogs = [
  {
    time: "00:08:41",
    type: "resource",
    label: "生产",
    text: "亚空间残渣回收完成：+25 [C]",
  },
  {
    time: "00:08:35",
    type: "intel",
    label: "情报",
    text: "白色边境村庄的巡逻概率已更新为 15%",
  },
  {
    time: "00:08:20",
    type: "system",
    label: "系统",
    text: "原体蓝图「边境实验体 α」通过合法性验证",
  },
  {
    time: "00:07:58",
    type: "expedition",
    label: "远征",
    text: "模拟远征已暂停，所有时钟保持当前进度",
  },
  {
    time: "00:07:32",
    type: "reward",
    label: "解锁",
    text: "生物因子槽位已就绪：2 × 2",
  },
  {
    time: "00:06:10",
    type: "system",
    label: "系统",
    text: "自动存档完成 // SCHEMA v1",
  },
];

export const territories = [
  {
    id: "void-base",
    name: "亚空间基地",
    kind: "基地",
    status: "secure",
    x: 16,
    y: 62,
    subtitle: "安全区域",
    distance: 0,
  },
  {
    id: "white-village",
    name: "白色边境村庄",
    kind: "教学领土",
    status: "known",
    x: 45,
    y: 30,
    subtitle: "部分情报",
    distance: 3,
  },
  {
    id: "green-village",
    name: "绿色林间村庄",
    kind: "教学领土",
    status: "known",
    x: 46,
    y: 77,
    subtitle: "部分情报",
    distance: 3,
  },
  {
    id: "gavony",
    name: "加渥尼",
    kind: "白绿城镇",
    status: "locked",
    x: 79,
    y: 51,
    subtitle: "信号受阻",
    distance: 6,
  },
];

export const factors = [
  { id: "human", name: "人类", category: "种族", cost: "1[W]", state: "installed" },
  { id: "warrior", name: "战士", category: "职业", cost: "100[C]", state: "installed" },
  { id: "sword", name: "青铜剑", category: "装备", cost: "100[C]", state: "installed" },
  { id: "shield", name: "圆盾", category: "装备", cost: "200[C]", state: "available" },
  { id: "brain", name: "大脑", category: "改造", cost: "100[C]", state: "locked" },
  { id: "ears", name: "妖精耳", category: "改造", cost: "200[C]", state: "locked" },
];

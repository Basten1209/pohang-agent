import type { RaceEvent } from '../schema'

/**
 * The demo race in English, Japanese and Chinese. Times, distances and the
 * map stay in the Korean original; place names keep the Korean spelling in
 * parentheses where a runner may need to read a sign.
 */
const dateIn = (date: string, tag: string) =>
  new Intl.DateTimeFormat(tag, {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00+09:00`))

export const eventTranslations = (date: string): RaceEvent['translations'] => ({
  en: {
    name: '2026 Pohang Yeongilman Beach Run',
    category: '10 km · 5 km',
    dateLabel: dateIn(date, 'en-US'),
    venue: 'Yeongildae Beach main stage (영일대해수욕장 특설무대)',
    address: 'Yeongildae Beach, Duho-dong, Buk-gu, Pohang, Gyeongbuk',
    cutoff: '10 km 90 min (finish closes 10:00) · 5 km 60 min',
    schedule: [
      { time: '07:00', label: 'Bag drop & changing rooms open, bib pickup' },
      { time: '08:00', label: 'Assembly · group warm-up' },
      { time: '08:30', label: '10 km start' },
      { time: '08:40', label: '5 km start' },
      { time: '09:40', label: '5 km time limit' },
      { time: '10:00', label: '10 km time limit · roads reopen' },
      { time: '10:30', label: 'Awards ceremony' },
      { time: '11:30', label: 'Bag pickup closes' },
    ],
    course: {
      summary:
        'A flat out-and-back from Yeongildae Beach south along the coastal road, turning at 5 km. The 5 km race turns at 2.5 km.',
      route: [
        'Start at the Yeongildae Beach main stage',
        'South along the coastal road',
        '2.5 km water station 1 (5 km turnaround)',
        '5 km turnaround · water station 2',
        '7.5 km water station 3',
        'Finish at Yeongildae',
      ],
      checkpoints: [
        { km: 2.5, label: 'Water station 1 · 5 km turnaround' },
        { km: 5, label: '10 km turnaround · water station 2' },
        { km: 7.5, label: 'Water station 3' },
        { km: 10, label: 'Finish' },
      ],
    },
    kit: [
      'Bib (on your chest, unfolded)',
      'Timing chip (on your right shoelace, no need to return)',
      'Bag drop tag (attach to your bag)',
      'A change of clothes · personal medication',
    ],
    facilities: [
      {
        label: 'Water',
        detail: '2.5 km · 5 km · 7.5 km · finish (water, sports drink)',
      },
      {
        label: 'Medical',
        detail: 'Medical tents at the start, 5 km turnaround and finish',
      },
      {
        label: 'Bag drop',
        detail: 'Tent right of the start, by last digit of bib · 07:00–11:30',
      },
      {
        label: 'Changing rooms',
        detail: 'Separate tents behind the main stage',
      },
      {
        label: 'Toilets',
        detail: 'Beach public toilets · portable toilets at the start',
      },
      {
        label: 'Race office',
        detail: 'Tent left of the main stage · lost & found, results',
      },
    ],
    rules: [
      'Past the time limit, please board the sweep bus.',
      'Transferred bibs and proxy runners are not ranked.',
      'Use one earbud only or keep the volume low.',
      'Running with pets or strollers is not allowed for safety.',
    ],
    notes: [
      'The coastal road is closed to cars 08:00–10:00.',
      'Shuttle: Pohang Station ↔ venue, 07:00–11:30, every 20 min (demo info).',
      'Venue parking is limited. Public transport or the shuttle is best.',
      'In bad weather the course may be shortened. Changes are announced in the app and on site.',
    ],
    faq: [
      {
        q: 'When do I get my bib?',
        a: 'Bibs are mailed in advance. If yours did not arrive, pick it up with ID at the race office from 07:00 on race day.',
      },
      {
        q: 'Where can I see my result?',
        a: 'Within 30 minutes of finishing, in the Race tab and on the results board on site.',
      },
      {
        q: 'Finisher medal and souvenir?',
        a: 'You get a medal and snacks right after the finish. The souvenir T-shirt comes with your bib.',
      },
      {
        q: 'Is the race cancelled if it rains?',
        a: 'It goes ahead in rain. Only severe weather warnings (wind, heavy rain) shorten or cancel it, announced by app and text.',
      },
      {
        q: 'How do I get to the venue?',
        a: 'From Pohang Station, the shuttle (07:00–11:30) or a city bus takes about 30 min to Yeongildae Beach. A taxi takes about 20 min.',
      },
      {
        q: 'Are there showers?',
        a: 'There are no showers at the venue, only changing rooms.',
      },
    ],
  },
  ja: {
    name: '2026 浦項・迎日湾ビーチラン',
    category: '10km・5km',
    dateLabel: dateIn(date, 'ja-JP'),
    venue: '迎日台海水浴場 特設ステージ（영일대해수욕장 특설무대）',
    address: '慶尚北道 浦項市 北区 斗湖洞 迎日台海水浴場',
    cutoff: '10km 90分（10:00 フィニッシュ締切）・5km 60分',
    schedule: [
      { time: '07:00', label: '荷物預かり・更衣室 開始、ゼッケン当日受取' },
      { time: '08:00', label: '集合・ストレッチ' },
      { time: '08:30', label: '10km スタート' },
      { time: '08:40', label: '5km スタート' },
      { time: '09:40', label: '5km 制限時間終了' },
      { time: '10:00', label: '10km 制限時間終了・交通規制解除' },
      { time: '10:30', label: '表彰式' },
      { time: '11:30', label: '荷物返却締切' },
    ],
    course: {
      summary:
        '迎日台海水浴場をスタートし、海岸道路を南へ走って5km地点で折り返す平坦な往復コースです。5km種目は2.5km地点で折り返します。',
      route: [
        '迎日台海水浴場 特設ステージ スタート',
        '海岸道路を南へ',
        '2.5km 第1給水所（5km 折り返し）',
        '5km 折り返し・第2給水所',
        '7.5km 第3給水所',
        '迎日台 フィニッシュ',
      ],
      checkpoints: [
        { km: 2.5, label: '第1給水所・5km 折り返し' },
        { km: 5, label: '10km 折り返し・第2給水所' },
        { km: 7.5, label: '第3給水所' },
        { km: 10, label: 'フィニッシュ' },
      ],
    },
    kit: [
      'ゼッケン（胸の前に、折らずに）',
      '計測チップ（右の靴ひもに固定、返却不要）',
      '荷物預かりタグ（バッグに付ける）',
      '着替え・常備薬',
    ],
    facilities: [
      {
        label: '給水所',
        detail: '2.5km・5km・7.5km・フィニッシュ（水・スポーツドリンク）',
      },
      {
        label: '救護',
        detail: 'スタート・5km 折り返し・フィニッシュに救護テント',
      },
      {
        label: '荷物預かり',
        detail: 'スタート右側のテント、ゼッケン末尾番号別・07:00–11:30',
      },
      { label: '更衣室', detail: '特設ステージ裏の男女別テント' },
      {
        label: 'トイレ',
        detail: '海水浴場の公衆トイレ・スタートの仮設トイレ',
      },
      {
        label: '大会本部',
        detail: '特設ステージ左側のテント・落とし物、記録の問い合わせ',
      },
    ],
    rules: [
      '制限時間を過ぎたら収容車に乗ってください。',
      'ゼッケンの譲渡・代理出走は記録が認められません。',
      'イヤホンは片耳だけにするか、音量を下げてください。',
      '安全のため、ペット・ベビーカーとの走行はできません。',
    ],
    notes: [
      '海岸道路は 08:00–10:00 に車両規制されます。',
      'シャトルバス：07:00–11:30 浦項駅 ↔ 会場、20分間隔（デモ情報）。',
      '会場の駐車場は狭いです。公共交通機関かシャトルをおすすめします。',
      '悪天候時はコースが短縮されることがあります。変更はアプリと場内放送でお知らせします。',
    ],
    faq: [
      {
        q: 'ゼッケンはいつ受け取りますか？',
        a: '事前の宅配が原則です。届いていない場合は、当日 07:00 から大会本部で身分証を見せて受け取れます。',
      },
      {
        q: '記録はどこで確認できますか？',
        a: 'フィニッシュから30分以内に、アプリのレースタブと会場の記録掲示板に載ります。',
      },
      {
        q: '完走メダルと記念品は？',
        a: 'フィニッシュ後すぐにメダルと軽食を受け取れます。記念Tシャツはゼッケンと一緒に届きます。',
      },
      {
        q: '雨が降ったら中止になりますか？',
        a: '雨天でも開催します。強風・大雨の警報など悪天候のときだけコースを短縮または中止し、アプリとSMSでお知らせします。',
      },
      {
        q: '会場までどう行けばいいですか？',
        a: '浦項駅からシャトル（07:00–11:30）か市内バスで迎日台海水浴場まで約30分です。タクシーなら約20分です。',
      },
      {
        q: 'シャワーはありますか？',
        a: '会場にシャワーはありません。更衣室のみです。',
      },
    ],
  },
  zh: {
    name: '2026 浦项迎日湾海滩跑',
    category: '10公里 · 5公里',
    dateLabel: dateIn(date, 'zh-CN'),
    venue: '迎日台海水浴场特设舞台（영일대해수욕장 특설무대）',
    address: '庆尚北道浦项市北区斗湖洞 迎日台海水浴场',
    cutoff: '10公里 90分钟（10:00 终点关门）· 5公里 60分钟',
    schedule: [
      { time: '07:00', label: '存包、更衣室开放，现场领取号码布' },
      { time: '08:00', label: '集合 · 集体拉伸' },
      { time: '08:30', label: '10公里起跑' },
      { time: '08:40', label: '5公里起跑' },
      { time: '09:40', label: '5公里关门' },
      { time: '10:00', label: '10公里关门 · 解除交通管制' },
      { time: '10:30', label: '颁奖典礼' },
      { time: '11:30', label: '取包截止' },
    ],
    course: {
      summary:
        '从迎日台海水浴场出发，沿海岸公路向南跑，在5公里处折返的平坦往返路线。5公里组在2.5公里处折返。',
      route: [
        '迎日台海水浴场特设舞台出发',
        '沿海岸公路向南',
        '2.5公里 1号补给站（5公里折返点）',
        '5公里折返点 · 2号补给站',
        '7.5公里 3号补给站',
        '迎日台终点',
      ],
      checkpoints: [
        { km: 2.5, label: '1号补给站 · 5公里折返点' },
        { km: 5, label: '10公里折返点 · 2号补给站' },
        { km: 7.5, label: '3号补给站' },
        { km: 10, label: '终点' },
      ],
    },
    kit: [
      '号码布（别在胸前，不要折叠）',
      '计时芯片（系在右脚鞋带上，无需归还）',
      '存包标签（挂在包上）',
      '替换衣物 · 个人常备药',
    ],
    facilities: [
      {
        label: '补给站',
        detail: '2.5公里 · 5公里 · 7.5公里 · 终点（水、运动饮料）',
      },
      { label: '医疗', detail: '起点、5公里折返点、终点设医疗帐篷' },
      {
        label: '存包',
        detail: '起点右侧帐篷，按号码布尾号 · 07:00–11:30',
      },
      { label: '更衣室', detail: '特设舞台后方男女分开的帐篷' },
      { label: '洗手间', detail: '海水浴场公共洗手间 · 起点移动厕所' },
      { label: '赛事本部', detail: '特设舞台左侧帐篷 · 失物招领、成绩咨询' },
    ],
    rules: [
      '超过关门时间请乘坐收容车。',
      '转让号码布或代跑的成绩不予认可。',
      '耳机请只戴一只或调低音量。',
      '为了安全，不允许携带宠物或推婴儿车跑步。',
    ],
    notes: [
      '海岸公路 08:00–10:00 禁止车辆通行。',
      '班车：07:00–11:30 浦项站 ↔ 赛场，每20分钟一班（演示信息）。',
      '赛场停车位有限，建议乘坐公共交通或班车。',
      '天气恶劣时路线可能缩短，变更会通过应用和现场广播通知。',
    ],
    faq: [
      {
        q: '什么时候领号码布？',
        a: '原则上提前快递寄送。如未收到，比赛当天 07:00 起凭身份证到赛事本部领取。',
      },
      {
        q: '在哪里查看成绩？',
        a: '完赛后30分钟内会出现在应用的比赛页和现场成绩公告板上。',
      },
      {
        q: '完赛奖牌和纪念品呢？',
        a: '过终点后立即领取奖牌和点心。纪念T恤随号码布一起发放。',
      },
      {
        q: '下雨会取消比赛吗？',
        a: '雨天照常举行。只有在大风、暴雨预警等恶劣天气时才会缩短路线或取消，并通过应用和短信通知。',
      },
      {
        q: '怎么去赛场？',
        a: '从浦项站乘班车（07:00–11:30）或市内公交到迎日台海水浴场约30分钟，出租车约20分钟。',
      },
      {
        q: '有淋浴设施吗？',
        a: '赛场没有淋浴设施，只有更衣室。',
      },
    ],
  },
})

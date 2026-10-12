import type { VenueText } from '../schema'

/** Venue text in English, Japanese and Chinese, keyed by venue id; names keep the Korean sign in parentheses. */
export const venueTranslations: Record<
  string,
  Partial<Record<'en' | 'ja' | 'zh', VenueText>>
> = {
  // ── food (구룡포) ───────────────────────────────────────────────────
  kkakkune: {
    en: {
      name: 'Kkakkune Mori-guksu (까꾸네 모리국수)',
      highlight: 'Mori-guksu',
      tenTaste: 'Mori-guksu',
      description:
        "Mori-guksu (spicy seafood noodle soup) is Guryongpo's local noodle dish, simmered hot and spicy with fish and seafood. A pick for tasting one of Pohang's 10 signature flavors in the market lanes.",
      note: 'Check ordering rules by party size and wait times before you go.',
    },
    ja: {
      name: 'カックネ・モリククス（까꾸네 모리국수）',
      highlight: 'モリククス',
      tenTaste: 'モリククス',
      description:
        'モリククス（魚介の辛い煮込み麺）は、魚や魚介を入れてピリ辛に煮込む九龍浦の郷土麺。市場の路地で浦項10味を味わえる候補です。',
      note: '人数ごとの注文条件と待ち時間は訪問前にご確認ください。',
    },
    zh: {
      name: '海鲜辣汤面馆（까꾸네 모리국수）',
      highlight: '海鲜辣汤面',
      tenTaste: '海鲜辣汤面',
      description:
        '海鲜辣汤面（모리국수）是加入鱼和海鲜熬煮的九龙浦家乡辣味面。可以在市场小巷里品尝浦项十味之一的推荐店。',
      note: '按人数点餐的规定和是否需要排队，请在出发前确认。',
    },
  },
  gangdugi: {
    en: {
      name: 'Gangdugi Susan (강두기수산)',
      highlight: 'Mulhoe · red snow crab',
      tenTaste: 'Pohang mulhoe',
      description:
        "A restaurant featured in Pohang City's tourist guide for its mulhoe (cold raw-fish soup) and red snow crab. Worth checking when you want a mulhoe meal.",
      note: "You'll need to travel toward Byeongpo-ri.",
    },
    ja: {
      name: 'カンドゥギ水産（강두기수산）',
      highlight: 'ムルフェ・紅ズワイガニ',
      tenTaste: '浦項ムルフェ',
      description:
        '浦項市の観光案内でムルフェ（冷たい刺身スープ）と紅ズワイガニが紹介された食堂です。ムルフェを食べたいときにチェックしてみてください。',
      note: 'ピョンポリ（병포리）方面への移動が必要です。',
    },
    zh: {
      name: 'Gangdugi水产（강두기수산）',
      highlight: '生鱼片冷汤 · 红雪蟹',
      tenTaste: '浦项生鱼片冷汤',
      description:
        '浦项市旅游指南介绍过其生鱼片冷汤（물회）和红雪蟹的餐厅。想吃生鱼片冷汤时可以看看。',
      note: '需要前往Byeongpo-ri（병포리）方向。',
    },
  },
  'halmae-sikdang': {
    en: {
      name: "Halmae Sikdang, Grandma's Diner (할매식당)",
      highlight: 'Hairtail stew · sandfish stew',
      description: 'A pick near the house street for fish stew with rice.',
    },
    ja: {
      name: 'ハルメ食堂（할매식당）',
      highlight: 'タチウオチゲ・ハタハタチゲ',
      description:
        '家屋通りの近くで、魚のチゲとごはんが食べられる食堂候補です。',
    },
    zh: {
      name: '奶奶食堂（할매식당）',
      highlight: '带鱼锅 · 叉牙鱼锅',
      description: '家屋街附近可以吃鱼汤配米饭的餐厅推荐。',
    },
  },
  cheolgyu: {
    en: {
      name: 'Cheolgyu Bunsik (철규분식)',
      highlight: 'Steamed buns · red bean porridge · janchi-guksu noodles',
      description:
        'A snack shop in front of Guryongpo Elementary School. Its featured menu pairs noodles or red bean porridge with steamed buns.',
    },
    ja: {
      name: 'チョルギュ粉食（철규분식）',
      highlight: '蒸しパン・ぜんざい・チャンチグクス',
      description:
        '九龍浦小学校前の軽食店。麺やぜんざいに蒸しパンを添えたメニューが紹介されています。',
    },
    zh: {
      name: 'Cheolgyu小吃店（철규분식）',
      highlight: '蒸包 · 红豆粥 · 喜面',
      description: '九龙浦小学门前的小吃店。推荐面条或红豆粥搭配蒸包的吃法。',
    },
  },
  'gwamegi-street': {
    en: {
      name: 'Guryongpo Gwamegi & Mulhoe Street (구룡포과메기물회거리)',
      highlight: 'A food street for gwamegi and mulhoe',
      tenTaste: 'Gwamegi · Pohang mulhoe',
      description:
        'A themed food street lined with gwamegi (half-dried saury) and mulhoe restaurants. Gwamegi is billed as a winter delicacy.',
      note: "This is Pohang City's marker for the whole food street. Browse nearby restaurants from the map pin.",
    },
    ja: {
      name: '九龍浦クァメギ・ムルフェ通り（구룡포과메기물회거리）',
      highlight: 'クァメギ・ムルフェ専門の飲食街',
      tenTaste: 'クァメギ・浦項ムルフェ',
      description:
        'クァメギ（サンマの半干し）とムルフェの店が集まるグルメテーマ通りです。クァメギは冬の味覚として紹介されています。',
      note: '飲食街全体を示す浦項市の案内上の位置です。地図のピンから周辺の店を探してみてください。',
    },
    zh: {
      name: '九龙浦秋刀鱼干·生鱼片冷汤街（구룡포과메기물회거리）',
      highlight: '秋刀鱼干 · 生鱼片冷汤美食街',
      tenTaste: '秋刀鱼干 · 浦项生鱼片冷汤',
      description:
        '秋刀鱼干（과메기）和生鱼片冷汤店聚集的美食主题街。秋刀鱼干被介绍为冬季美味。',
      note: '这是浦项市标注的整条美食街位置。可从地图标记查看周边餐厅。',
    },
  },

  // ── cafe (구룡포) ───────────────────────────────────────────────────
  coffee311: {
    en: {
      name: 'Coffee 311 (커피311)',
      highlight: 'A rest stop at the Guryongpo–Homigot junction',
      description:
        'Pohang City describes it as a café where a drama film crew also took breaks.',
    },
    ja: {
      name: 'コーヒー311（커피311）',
      highlight: '九龍浦・虎尾串の三叉路にある休憩スポット',
      description:
        '浦項市が、ドラマの撮影チームも立ち寄って休んだカフェとして紹介しています。',
    },
    zh: {
      name: 'Coffee 311（커피311）',
      highlight: '九龙浦·虎尾串三岔路口的歇脚处',
      description: '浦项市介绍这里是电视剧剧组也曾歇脚的咖啡馆。',
    },
  },
  'default-coffee': {
    en: {
      name: 'Default Coffee Bar (디폴트커피바)',
      highlight: 'Beach sea view · coffee and desserts',
      description:
        'A café where you can rest looking out over Guryongpo Beach.',
      note: "You'll need to travel toward the beach in Samjeong-ri.",
    },
    ja: {
      name: 'デフォルト・コーヒーバー（디폴트커피바）',
      highlight: '海水浴場のオーシャンビュー・コーヒーとデザート',
      description: '九龍浦海水浴場を眺めながらひと休みできるカフェです。',
      note: 'サムジョンリ（삼정리）の海水浴場方面への移動が必要です。',
    },
    zh: {
      name: 'Default咖啡吧（디폴트커피바）',
      highlight: '海水浴场海景 · 咖啡和甜点',
      description: '可以眺望九龙浦海水浴场、歇歇脚的咖啡馆。',
      note: '需要前往Samjeong-ri（삼정리）海水浴场方向。',
    },
  },

  // ── street (구룡포) ─────────────────────────────────────────────────
  'japanese-street': {
    en: {
      name: 'Guryongpo Japanese House Street (구룡포 일본인 가옥거리)',
      highlight: "One of Pohang's 12 scenic spots · historic lanes",
      description:
        'Take in the harbor-town scenery in lanes where old houses still stand.',
      note: 'Per the official notice, the nearby modern history museum is closed until November 2026. Walking the outdoor street is a separate visit.',
    },
    ja: {
      name: '九龍浦日本人家屋通り（구룡포 일본인 가옥거리）',
      highlight: '浦項12景・歴史ある路地',
      description: '昔の家屋が残る路地で、港町の風景を見て回りましょう。',
      note: '公式案内によると、近くの近代歴史館は2026年11月まで休館です。屋外の通りの見学とは区別してください。',
    },
    zh: {
      name: '九龙浦日本人家屋街（구룡포 일본인 가옥거리）',
      highlight: '浦项十二景 · 历史小巷',
      description: '在保留着老房子的小巷里，看看港口小镇的风景。',
      note: '据官方通知，附近的近代历史馆闭馆至2026年11月，请与户外街道游览区分开。',
    },
  },
  'ara-square': {
    en: {
      name: 'Guryongpo Ara Square (구룡포 아라광장)',
      highlight: 'Harborfront square · drama filming site',
      description:
        'A square right on Guryongpo Port. Stop by along with the house street to take in the harbor views.',
    },
    ja: {
      name: '九龍浦アラ広場（구룡포 아라광장）',
      highlight: '港前の広場・ドラマのロケ地',
      description:
        '九龍浦港に面した広場。家屋通りとあわせて立ち寄り、港の風景を楽しめます。',
    },
    zh: {
      name: '九龙浦阿拉广场（구룡포 아라광장）',
      highlight: '港口前广场 · 电视剧取景地',
      description: '紧邻九龙浦港的广场。可以和家屋街一起逛，看看港口风景。',
    },
  },
  'guryongpo-port': {
    en: {
      name: 'Guryongpo Port (구룡포항)',
      highlight: 'Fishing boats and harbor views',
      description:
        'Close to the market and the house street, take in everyday life at the port.',
    },
    ja: {
      name: '九龍浦港（구룡포항）',
      highlight: '漁船と港の風景',
      description: '市場や家屋通りのすぐ近くで、港の日常を見て回れます。',
    },
    zh: {
      name: '九龙浦港（구룡포항）',
      highlight: '渔船与港口风景',
      description: '离市场和家屋街都很近，可以看看港口的日常。',
    },
  },
  'janggilri-park': {
    en: {
      name: 'Janggil-ri Fishing Park (장길리 복합낚시공원)',
      highlight: 'Sea views · coastal photos',
      description:
        'Pohang City features it as a drama filming site and a spot for sea photos.',
      note: "You'll need a separate trip to Janggil-ri.",
    },
    ja: {
      name: 'チャンギルリ複合釣り公園（장길리 복합낚시공원）',
      highlight: '海の風景・海岸の写真',
      description:
        '浦項市がドラマのロケ地、海の写真スポットとして紹介している場所です。',
      note: 'チャンギルリまで別途移動が必要です。',
    },
    zh: {
      name: 'Janggil-ri综合钓鱼公园（장길리 복합낚시공원）',
      highlight: '海景 · 海岸摄影',
      description: '浦项市介绍的电视剧取景地和海景拍照胜地。',
      note: '需要另外前往Janggil-ri。',
    },
  },

  // ── gp-museum ──────────────────────────────────────────────────────
  'gwamegi-museum': {
    en: {
      name: 'Guryongpo Gwamegi Culture Center (구룡포 과메기문화관)',
      highlight: 'Indoor exhibits · marine activities',
      description:
        "Enjoy exhibits and hands-on activities themed on Pohang's sea and gwamegi (half-dried saury).",
      note: "There's an uphill walk. Check closing days and whether it's open for visits.",
    },
    ja: {
      name: '九龍浦クァメギ文化館（구룡포 과메기문화관）',
      highlight: '屋内展示・海洋体験',
      description:
        '浦項の海とクァメギ（サンマの半干し）をテーマにした展示や体験を楽しめます。',
      note: '上り坂があります。休館日と観覧できるかどうかをご確認ください。',
    },
    zh: {
      name: '九龙浦秋刀鱼干文化馆（구룡포 과메기문화관）',
      highlight: '室内展览 · 海洋体验',
      description:
        '以浦项的大海和秋刀鱼干（과메기）为主题，可以看展览、做体验。',
      note: '有一段上坡。请确认闭馆日以及能否参观。',
    },
  },

  // ── 호미곶 ──────────────────────────────────────────────────────────
  daebori286: {
    en: {
      name: 'Daebo-ri 286 Restaurant (대보리286식당)',
      highlight: 'Clam kalguksu · sea urchin bibimbap',
      description:
        'A pick for a meal close to Sunrise Plaza. Its map listing shows kalguksu (knife-cut noodles) and sea urchin bibimbap on the menu.',
    },
    ja: {
      name: 'テボリ286食堂（대보리286식당）',
      highlight: 'アサリカルグクス・ウニビビンバ',
      description:
        '日の出広場の近くで食事ができる候補です。地図の店舗情報のメニューに、カルグクス（手切り麺）とウニビビンバが載っています。',
    },
    zh: {
      name: 'Daebo-ri 286食堂（대보리286식당）',
      highlight: '花蛤刀切面 · 海胆拌饭',
      description:
        '日出广场附近可以用餐的推荐店。地图上的店铺菜单列有刀切面和海胆拌饭。',
    },
  },
  offing: {
    en: {
      name: 'Offing Café (오핑 카페)',
      highlight: 'The café from a TV drama',
      description:
        'A Homigot filming-location café featured by Pohang City. Rest by the sea in Guman-ri.',
      note: "Per its map listing, it's closed Mondays and Tuesdays. You'll need a separate trip from the plaza to Guman-ri.",
    },
    ja: {
      name: 'オフィン・カフェ（오핑 카페）',
      highlight: 'ドラマに登場するカフェ',
      description:
        '浦項市が紹介した虎尾串のロケ地カフェ。クマンリの海辺でひと休みできます。',
      note: '地図の案内では月・火曜日が定休日です。広場からクマンリまで別途移動が必要です。',
    },
    zh: {
      name: 'Offing咖啡（오핑 카페）',
      highlight: '电视剧里的咖啡馆',
      description: '浦项市介绍的虎尾串取景地咖啡馆。可以在Guman-ri海边歇歇脚。',
      note: '据地图信息，每周一、周二休息。需要从广场另外前往Guman-ri。',
    },
  },
  nest: {
    en: {
      name: 'Nest Café (네스트카페)',
      highlight: 'Sea view · coffee',
      description:
        'Described as a large café where you can rest looking out at the sea.',
      note: 'A pick outside Sunrise Plaza that needs a separate trip.',
    },
    ja: {
      name: 'ネストカフェ（네스트카페）',
      highlight: 'オーシャンビュー・コーヒー',
      description:
        '海を眺めながらひと休みできる大型カフェとして紹介されています。',
      note: '日の出広場の外にあり、別途移動が必要な候補です。',
    },
    zh: {
      name: 'Nest咖啡（네스트카페）',
      highlight: '海景 · 咖啡',
      description: '据介绍是可以看着大海歇脚的大型咖啡馆。',
      note: '位于日出广场之外，需要另外前往。',
    },
  },
  hands: {
    en: {
      name: 'Hands of Harmony (상생의 손)',
      highlight: 'Homigot Sunrise Plaza · sea photos',
      description:
        'See the hand sculptures facing each other from sea and land.',
    },
    ja: {
      name: '相生の手（상생의 손）',
      highlight: '虎尾串 日の出広場・海の写真',
      description: '海と陸から向かい合う手のオブジェに会いに行きましょう。',
    },
    zh: {
      name: '相生之手（상생의 손）',
      highlight: '虎尾串日出广场 · 海景照片',
      description: '去看看从海上和陆地彼此相对的手形雕塑吧。',
    },
  },
  'lighthouse-museum': {
    en: {
      name: 'National Lighthouse Museum (국립등대박물관)',
      highlight: 'Lighthouse and navigation aid exhibits',
      description:
        'An indoor pick for exploring the history of lighthouses and navigation aids.',
    },
    ja: {
      name: '国立灯台博物館（국립등대박물관）',
      highlight: '灯台と航路標識の展示',
      description: '灯台の歴史と航路標識を見て回る屋内観覧の候補です。',
    },
    zh: {
      name: '国立灯塔博物馆（국립등대박물관）',
      highlight: '灯塔与航标展览',
      description: '了解灯塔历史和航标的室内参观推荐。',
    },
  },
  'millennium-hall': {
    en: {
      name: 'New Millennium Memorial Hall (새천년기념관)',
      highlight: 'Exhibits · rooftop observatory',
      description:
        'At Sunrise Plaza, a spot with views over the East Sea and the Homigot coast.',
    },
    ja: {
      name: '新千年記念館（새천년기념관）',
      highlight: '展示・屋上展望台',
      description: '日の出広場から東海と虎尾串の海岸を一望できる場所です。',
    },
    zh: {
      name: '新千年纪念馆（새천년기념관）',
      highlight: '展览 · 屋顶观景台',
      description: '在日出广场眺望韩国东海和虎尾串海岸的地方。',
    },
  },
}

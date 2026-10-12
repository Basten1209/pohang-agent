import type { PlaceText } from '../schema'

/** Place text in English, Japanese and Chinese, keyed by place id; empty Korean fields stay untranslated. */
export const placeTranslations: Record<
  string,
  Partial<Record<'en' | 'ja' | 'zh', PlaceText>>
> = {
  // ── 구룡포 ──────────────────────────────────────────────────────────
  food: {
    en: {
      title: 'A hearty meal in Guryongpo',
      short: 'Harbor lunch',
      subtitle: 'Guryongpo Market · restaurant picks',
      desc: 'That welcome post-run hunger. Start your trip with an unhurried lunch near Guryongpo Market.',
      detail:
        'Known for gwamegi (half-dried saury) in winter, and snow crab, mulhoe (cold raw-fish soup) and mori-guksu (spicy seafood noodle soup) all year. Whether you can eat alone, plus menus, prices and hours, vary by restaurant.',
      actionLabel: 'Meal',
      tips: 'Some places only take mori-guksu orders for two or more.',
    },
    ja: {
      title: '九龍浦でしっかりごはん',
      short: '港の前でランチ',
      subtitle: '九龍浦市場・食堂候補',
      desc: '走ったあとのうれしい空腹。九龍浦市場の近くでゆっくりランチを食べて、旅を始めましょう。',
      detail:
        '冬はクァメギ（サンマの半干し）、一年中ズワイガニ・ムルフェ（冷たい刺身スープ）・モリククス（魚介の辛い煮込み麺）が有名です。一人での食事の可否やメニュー・価格・営業時間は店によって異なります。',
      actionLabel: '食事',
      tips: 'モリククスは2人前以上からしか注文できない店もあります。',
    },
    zh: {
      title: '在九龙浦好好吃一顿',
      short: '港口午餐',
      subtitle: '九龙浦市场 · 餐厅推荐',
      desc: '跑完步后迎来久违的饥饿感。在九龙浦市场附近悠闲地吃顿午饭，开始旅程吧。',
      detail:
        '冬季的秋刀鱼干（과메기），以及四季皆有的雪蟹、生鱼片冷汤（물회）和海鲜辣汤面（모리국수）都很有名。能否一人用餐以及菜单、价格、营业时间因店而异。',
      actionLabel: '用餐',
      tips: '有的店海鲜辣汤面需两人以上才能点。',
    },
  },
  street: {
    en: {
      title: 'Through the lanes: a Guryongpo snapshot',
      short: 'Japanese House Street',
      subtitle: 'Old houses and narrow lanes',
      desc: "The Japanese House Street, where the harbor town's past lingers. Take a short look around and grab today's photo.",
      detail:
        'Walk a short stretch of the roughly 450 m street lined with early-modern houses. The stone stairs up to Guryongpo Park are left out of the route.',
      actionLabel: 'Sightseeing',
      tips: "It's known as a drama filming location, so it gets crowded on weekend afternoons.",
    },
    ja: {
      title: '路地をたどって、九龍浦の一枚',
      short: '日本人家屋通り',
      subtitle: '古い家並みと小さな路地',
      desc: '港町の時間が残る日本人家屋通り。さっと見て回り、今日の一枚を撮りましょう。',
      detail:
        '近代の家屋が並ぶ約450mの通りの短い区間を巡ります。九龍浦公園へ上る石段はコースから外しました。',
      actionLabel: '見物',
      tips: 'ドラマのロケ地として知られ、週末の午後は混み合います。',
    },
    zh: {
      title: '沿着小巷，留下一张九龙浦',
      short: '日本人家屋街',
      subtitle: '老房子与小巷',
      desc: '留存着港口小镇旧时光的日本人家屋街。简单逛逛，拍下今天的照片。',
      detail:
        '沿着近代房屋林立、全长约450米的街道走一小段。通往九龙浦公园的石阶已从路线中去掉。',
      actionLabel: '游览',
      tips: '这里作为电视剧取景地而出名，周末下午人很多。',
    },
  },
  'gp-museum': {
    en: {
      title: 'The gwamegi story, indoors',
      short: 'Gwamegi Culture Center',
      subtitle: 'Up at Guryongpo Park · indoor exhibits',
      desc: "An indoor exhibition hall on the history of gwamegi, Guryongpo's signature dish, and fishing-village life. A good alternative when the wind is cold or the air is poor.",
      detail:
        'It sits above the stone stairs of Guryongpo Park at the end of the house street, so expect an uphill walk. Check admission and closing days before you go.',
      actionLabel: 'Visit',
      tips: 'Going around by the road instead of the stairs takes longer.',
    },
    ja: {
      title: 'クァメギの物語を屋内で',
      short: '九龍浦クァメギ文化館',
      subtitle: '九龍浦公園の上・屋内展示',
      desc: '九龍浦を代表するクァメギの歴史と漁村の暮らしを紹介する屋内展示館。風が冷たい日や空気が悪い日の代わりにどうぞ。',
      detail:
        '家屋通りの奥、九龍浦公園の石段を上った先にあるため、上り坂を歩く必要があります。観覧料・休館日は訪問前にご確認ください。',
      actionLabel: '観覧',
      tips: '階段の代わりに車道から回る道はもっと長くなります。',
    },
    zh: {
      title: '在室内了解秋刀鱼干的故事',
      short: '九龙浦秋刀鱼干文化馆',
      subtitle: '九龙浦公园上方 · 室内展览',
      desc: '介绍九龙浦代表美食秋刀鱼干的历史和渔村生活的室内展馆。风冷或空气质量差的日子可作为备选。',
      detail:
        '位于家屋街尽头、九龙浦公园石阶之上，需要走一段上坡路。门票和闭馆日请在出发前确认。',
      actionLabel: '参观',
      tips: '不走台阶、绕行车道的路更远。',
    },
  },
  cafe: {
    en: {
      title: 'An unhurried cup of coffee',
      short: 'Lane café break',
      subtitle: 'Near the house street · café picks',
      desc: 'End the trip at an easy pace. Sit and rest a while, taking in the harbor-town mood.',
      detail:
        'There are several small cafés around the house street. Hours and seating vary by café.',
      actionLabel: 'Break',
    },
    ja: {
      title: '急がずにコーヒーを一杯',
      short: '路地のカフェで休憩',
      subtitle: '家屋通り周辺・カフェ候補',
      desc: '旅の締めくくりはのんびりと。港町の雰囲気を感じながら、座ってひと休みしましょう。',
      detail:
        '家屋通りの周辺に小さなカフェがいくつかあります。営業時間と席は店によって異なります。',
      actionLabel: '休憩',
    },
    zh: {
      title: '不慌不忙喝杯咖啡',
      short: '巷子咖啡馆小憩',
      subtitle: '家屋街附近 · 咖啡馆推荐',
      desc: '旅程的最后放慢脚步。感受港口小镇的氛围，坐下来歇一会儿。',
      detail: '家屋街周边有几家小咖啡馆。营业时间和座位因店而异。',
      actionLabel: '休息',
    },
  },

  // ── 호미곶 ──────────────────────────────────────────────────────────
  'hm-food': {
    en: {
      title: 'A bowl of mulhoe by Sunrise Plaza',
      short: 'Homigot eateries',
      subtitle: 'Around Sunrise Plaza · restaurant picks',
      desc: 'Fill up on cool mulhoe (cold raw-fish soup) or seafood kalguksu (knife-cut noodles) at the restaurants facing the plaza.',
      detail:
        'Mulhoe and seafood restaurants cluster around the plaza. Menus, prices and hours vary by restaurant.',
      actionLabel: 'Meal',
    },
    ja: {
      title: '日の出広場の前でムルフェを一杯',
      short: '虎尾串の食堂街',
      subtitle: '日の出広場周辺・食堂候補',
      desc: '広場前の食堂街で、冷たいムルフェ（冷たい刺身スープ）や海鮮カルグクス（手切り麺）でお腹を満たしましょう。',
      detail:
        '広場の周辺にムルフェ・海鮮の食堂が集まっています。メニュー・価格・営業時間は店によって異なります。',
      actionLabel: '食事',
    },
    zh: {
      title: '日出广场前来碗生鱼片冷汤',
      short: '虎尾串餐饮街',
      subtitle: '日出广场周边 · 餐厅推荐',
      desc: '在广场前的餐饮街，用清凉的生鱼片冷汤或海鲜刀切面填饱肚子。',
      detail:
        '广场周边聚集着生鱼片冷汤和海鲜餐厅。菜单、价格、营业时间因店而异。',
      actionLabel: '用餐',
    },
  },
  'hm-hand': {
    en: {
      title: 'A hand rising from the sea: Hands of Harmony',
      short: 'Hands of Harmony',
      subtitle: 'Homigot Sunrise Plaza',
      desc: "Giant hand sculptures, one in the sea and one on the plaza. Take today's photo against the sea at the eastern tip of the Korean Peninsula.",
      detail:
        "The plaza is wide and flat, so it's easy on the legs, but it's often very windy. It's outdoors, so it drops out of the route when air quality is poor.",
      actionLabel: 'Sightseeing',
      tips: 'The sea wind is cold. Put on a layer after your run, before the sweat cools.',
    },
    ja: {
      title: '海からそびえる手、相生の手',
      short: '相生の手',
      subtitle: '虎尾串 日の出広場',
      desc: '海と広場に一つずつ立つ巨大な手のオブジェ。朝鮮半島の東端の海を背景に、今日の一枚を撮りましょう。',
      detail:
        '広場は広くて平らなので歩く負担は少ないですが、風の強い日が多いです。屋外のため、大気の状態が悪いとコースから外れます。',
      actionLabel: '見物',
      tips: '海風が冷たいので、完走後は汗が冷える前に上着を羽織りましょう。',
    },
    zh: {
      title: '从海中升起的手——相生之手',
      short: '相生之手',
      subtitle: '虎尾串日出广场',
      desc: '海中和广场上各立着一只巨大的手形雕塑。以朝鲜半岛最东端的大海为背景，拍下今天的照片。',
      detail:
        '广场宽阔平坦，步行负担小，但经常风很大。因为在户外，空气质量差时会从路线中去掉。',
      actionLabel: '游览',
      tips: '海风很冷，跑完后趁汗还没凉，记得穿上外套。',
    },
  },
  'hm-museum': {
    en: {
      title: 'All about lighthouses',
      short: 'National Lighthouse Museum',
      subtitle: 'Next to Sunrise Plaza · indoor exhibits',
      desc: "A museum of Korea's lighthouse history and equipment. It's right next to the plaza, so the walk is short.",
      detail:
        'Mostly indoor exhibits, so the weather matters little. Check admission and closing days before you go.',
      actionLabel: 'Visit',
    },
    ja: {
      title: '灯台のすべて',
      short: '国立灯台博物館',
      subtitle: '日の出広場の隣・屋内展示',
      desc: '韓国の灯台の歴史と設備を集めた博物館。広場のすぐ隣なので、移動が短くて済みます。',
      detail:
        '屋内展示が中心なので天気の影響が少ないです。観覧料・休館日は訪問前にご確認ください。',
      actionLabel: '観覧',
    },
    zh: {
      title: '关于灯塔的一切',
      short: '国立灯塔博物馆',
      subtitle: '日出广场旁 · 室内展览',
      desc: '汇集韩国灯塔历史与设备的博物馆。就在广场旁边，走动距离短。',
      detail: '以室内展览为主，受天气影响小。门票和闭馆日请在出发前确认。',
      actionLabel: '参观',
    },
  },
  'hm-cafe': {
    en: {
      title: 'Rest with a sea view',
      short: 'Plaza café',
      subtitle: 'Around Sunrise Plaza · café picks',
      desc: 'Rest your legs at a café with the East Sea outside the window.',
      detail:
        'Rest while watching the sea at cafés around the plaza. Hours vary by café.',
      actionLabel: 'Break',
    },
    ja: {
      title: '海を眺めてひと休み',
      short: '広場前のカフェ',
      subtitle: '日の出広場周辺・カフェ候補',
      desc: '窓の外に東海（トンヘ）が見えるカフェで足を休めましょう。',
      detail:
        '広場周辺のカフェで海を眺めながら休めます。営業時間は店によって異なります。',
      actionLabel: '休憩',
    },
    zh: {
      title: '看着大海歇歇脚',
      short: '广场前咖啡馆',
      subtitle: '日出广场周边 · 咖啡馆推荐',
      desc: '在窗外就能看到韩国东海的咖啡馆里，让双腿休息一下。',
      detail: '可以在广场周边的咖啡馆边看海边休息。营业时间因店而异。',
      actionLabel: '休息',
    },
  },

  // ── 영일대·스페이스워크 ─────────────────────────────────────────────
  'yd-mulhoe': {
    en: {
      title: 'Pohang-style mulhoe at Seolmeori',
      short: 'Seolmeori mulhoe area',
      subtitle: 'North of Yeongildae · a cluster of mulhoe restaurants',
      desc: 'A short way north of the race venue, mulhoe places cluster together. Have a cool bowl of Pohang-style mulhoe (cold raw-fish soup) after your run.',
      detail:
        'Pohang-style mulhoe is often eaten by adding water little by little to the gochujang sauce. Menus, prices and hours vary by restaurant.',
      actionLabel: 'Meal',
      tips: 'On race day, runners pour in at lunchtime, so the wait can be long.',
    },
    ja: {
      title: '浦項式ムルフェをソルモリで',
      short: 'ソルモリ・ムルフェ街',
      subtitle: '迎日台の北・ムルフェ店が集まる場所',
      desc: '大会会場から少し北へ行くと、ムルフェの店が集まっています。走ったあとに冷たい浦項式ムルフェ（冷たい刺身スープ）を一杯。',
      detail:
        '浦項式ムルフェは、コチュジャンのたれに水を少しずつ注いで食べるスタイルが多いです。メニュー・価格・営業時間は店によって異なります。',
      actionLabel: '食事',
      tips: '大会当日の昼はランナーが押し寄せ、待ち時間が長くなることがあります。',
    },
    zh: {
      title: '在Seolmeori吃浦项式生鱼片冷汤',
      short: 'Seolmeori冷汤街',
      subtitle: '迎日台北侧 · 生鱼片冷汤店聚集地',
      desc: '从比赛场地往北走一小段，就有成片的生鱼片冷汤店。跑完来一碗清凉的浦项式生鱼片冷汤（물회）。',
      detail:
        '浦项式生鱼片冷汤多是在辣椒酱调料里一点点加水来吃。菜单、价格、营业时间因店而异。',
      actionLabel: '用餐',
      tips: '比赛当天午餐时段跑者很多，可能要等很久。',
    },
  },
  'yd-pavilion': {
    en: {
      title: 'Catch your breath on a pavilion over the sea',
      short: 'Yeongildae Sea Pavilion',
      subtitle: 'Off Yeongildae Beach',
      desc: "A pavilion over the sea, linked to the beach by a bridge. It's right by the finish line, a favorite spot for finisher photos.",
      detail: 'The path across the bridge to the pavilion is flat.',
      actionLabel: 'Walk',
    },
    ja: {
      title: '海の上の楼閣でひと息',
      short: '迎日台海上楼閣',
      subtitle: '迎日台海水浴場の前の海',
      desc: '海水浴場から橋でつながる海上の楼閣。フィニッシュラインのすぐ前で、完走写真の名所です。',
      detail: '橋を渡って楼閣まで平坦な道です。',
      actionLabel: '散歩',
    },
    zh: {
      title: '在海上楼阁喘口气',
      short: '迎日台海上楼阁',
      subtitle: '迎日台海水浴场前的海上',
      desc: '由桥与海滩相连的海上楼阁。就在终点线前，是拍完赛照片的热门地点。',
      detail: '过桥到楼阁都是平路。',
      actionLabel: '散步',
    },
  },
  'yd-spacewalk': {
    en: {
      title: 'A walkway in the sky',
      short: 'Space Walk',
      subtitle: 'Hwanho Park · a walkable sculpture',
      desc: 'A sculpture you climb on foot, its stair track curving like a roller coaster. From the top you can see all of Yeongil Bay.',
      detail:
        'The track is about 333 m of continuous stairs and slopes, which can be hard on tired legs. It closes in strong wind or rain. Check opening hours and visitor limits before you go.',
      actionLabel: 'Activity',
      tips: "There's an uphill walk from the park entrance to the track.",
    },
    ja: {
      title: '空を歩くトラック',
      short: 'スペースウォーク',
      subtitle: '環湖公園・歩けるオブジェ',
      desc: 'ジェットコースターのように曲がった階段のトラックを、自分の足で上っていくオブジェ。頂上から迎日湾が一望できます。',
      detail:
        'トラックは約333mで、階段と傾斜が続くため、脚が疲れた日には負担になることがあります。強風・雨天時は運営を停止します。運営時間・人数制限は訪問前にご確認ください。',
      actionLabel: '体験',
      tips: '公園の入口からトラックまで上り坂があります。',
    },
    zh: {
      title: '在天空中行走的步道',
      short: '太空漫步',
      subtitle: '环湖公园 · 可以行走的雕塑',
      desc: '阶梯步道像过山车一样弯曲，需要亲自走上去的雕塑。从顶端可以将迎日湾尽收眼底。',
      detail:
        '步道约333米，台阶和坡道连续不断，腿累的时候可能会吃力。强风或下雨时停止开放。开放时间和人数限制请在出发前确认。',
      actionLabel: '体验',
      tips: '从公园入口到步道有一段上坡。',
    },
  },
  'yd-art': {
    en: {
      title: 'An art museum in the park',
      short: 'Pohang Museum of Art',
      subtitle: 'Inside Hwanho Park · indoor exhibits',
      desc: 'The city art museum, in the same park as Space Walk. Take a break and see an exhibition.',
      detail: 'Check exhibition schedules and closing days before you go.',
      actionLabel: 'Visit',
    },
    ja: {
      title: '公園の中の美術館',
      short: '浦項市立美術館',
      subtitle: '環湖公園内・屋内展示',
      desc: 'スペースウォークと同じ公園にある市立美術館。ひと休みしながら展示を見ましょう。',
      detail: '展示スケジュール・休館日は訪問前にご確認ください。',
      actionLabel: '観覧',
    },
    zh: {
      title: '公园里的美术馆',
      short: '浦项市立美术馆',
      subtitle: '环湖公园内 · 室内展览',
      desc: '与太空漫步位于同一公园的市立美术馆。边休息边看展览吧。',
      detail: '展览日程和闭馆日请在出发前确认。',
      actionLabel: '参观',
    },
  },
  'yd-cafe': {
    en: {
      title: 'Wrap up at a beach café',
      short: 'Yeongildae café street',
      subtitle: 'Cafés lining the beach',
      desc: 'Cafés line the beach. Watch the sea and enjoy the afterglow of your finish.',
      detail: 'Cafés line the beach. Hours and seating vary by café.',
      actionLabel: 'Break',
    },
    ja: {
      title: '海辺のカフェで締めくくり',
      short: '迎日台カフェ通り',
      subtitle: '海水浴場沿いに並ぶカフェ',
      desc: '海辺に沿ってカフェが続いています。海を眺めながら完走の余韻を楽しみましょう。',
      detail:
        '海辺に沿ってカフェが続いています。営業時間・席は店によって異なります。',
      actionLabel: '休憩',
    },
    zh: {
      title: '在海边咖啡馆收尾',
      short: '迎日台咖啡街',
      subtitle: '沿海水浴场排开的咖啡馆',
      desc: '沿着海滩有一排咖啡馆。边看海边回味完赛的感觉。',
      detail: '沿着海滩有一排咖啡馆。营业时间和座位因店而异。',
      actionLabel: '休息',
    },
  },

  // ── 죽도시장·포항운하 ───────────────────────────────────────────────
  'jd-market': {
    en: {
      title: "A plate of raw fish at the East Coast's top market",
      short: 'Jukdo Market',
      subtitle: 'Raw fish center · mulhoe · snow crab',
      desc: 'One of the biggest traditional markets on the East Coast. Eat the raw fish you pick at the raw fish center on the spot, or have mulhoe (cold raw-fish soup) at a market restaurant.',
      detail:
        "The market is big, so just getting around can mean nearly 10 minutes on foot. Prices vary by shop, so it's best to ask first. Closing days vary by shop.",
      actionLabel: 'Meal',
      tips: "It's busy at weekend lunchtimes. Many restaurants on the raw fish center's 2nd floor charge a table setting fee.",
    },
    ja: {
      title: '東海岸を代表する市場で刺身をひと皿',
      short: '竹島市場',
      subtitle: '刺身センター・ムルフェ・ズワイガニ',
      desc: '東海岸でも指折りの大きな伝統市場。刺身センターで選んだ刺身をその場で食べたり、市場の食堂でムルフェ（冷たい刺身スープ）を食べたりできます。',
      detail:
        '市場が広く、移動だけで10分近く歩くこともあります。店によって価格が違うので、先に聞いておくのがおすすめです。休業日は店によって異なります。',
      actionLabel: '食事',
      tips: '週末の昼は混み合います。刺身センター2階の食堂では、席料（サンチャリム代）がかかる店が多いです。',
    },
    zh: {
      title: '在东海岸代表性市场来一盘生鱼片',
      short: '竹岛市场',
      subtitle: '生鱼片中心 · 生鱼片冷汤 · 雪蟹',
      desc: '东海岸数一数二的大型传统市场。可以在生鱼片中心挑好鱼当场吃，也可以在市场餐馆吃生鱼片冷汤（물회）。',
      detail:
        '市场很大，光是走动就可能要将近10分钟。各店价格不同，最好先问清楚。休息日因店而异。',
      actionLabel: '用餐',
      tips: '周末午餐时段人多。生鱼片中心2楼的餐馆大多收取摆桌费。',
    },
  },
  'jd-canalhall': {
    en: {
      title: 'How a waterway became a canal',
      short: 'Pohang Canal Hall',
      subtitle: 'Start of the canal · indoor exhibits',
      desc: "An exhibition hall telling the story of Pohang Canal, built by reconnecting a blocked waterway. It's right next to the cruise boarding point.",
      detail: 'Check opening hours and closing days before you go.',
      actionLabel: 'Visit',
    },
    ja: {
      title: '運河になった水路の物語',
      short: '浦項運河館',
      subtitle: '運河の起点・屋内展示',
      desc: 'ふさがっていた水路を再びつないで造った浦項運河の物語を紹介する展示館。クルーズ乗り場のすぐ隣です。',
      detail: '観覧時間・休館日は訪問前にご確認ください。',
      actionLabel: '観覧',
    },
    zh: {
      title: '水路变运河的故事',
      short: '浦项运河馆',
      subtitle: '运河起点 · 室内展览',
      desc: '讲述浦项运河如何将堵塞的水路重新连通的展馆。就在游船乘船处旁边。',
      detail: '参观时间和闭馆日请在出发前确认。',
      actionLabel: '参观',
    },
  },
  'jd-cruise': {
    en: {
      title: 'A loop of the canal by boat',
      short: 'Pohang Canal Cruise',
      subtitle: 'Canal → Dongbin Inner Harbor, round trip',
      desc: 'A sightseeing boat where you sit and take in the canal, the inner harbor and views toward the sea. On heavy-legged days, you can sightsee without walking.',
      detail:
        "It's very windy on the boat. Check sailing times, fares and weather cancellations before you go.",
      actionLabel: 'Boat ride',
    },
    ja: {
      title: '船で運河をひと巡り',
      short: '浦項運河クルーズ',
      subtitle: '運河 → 東濱内港 往復',
      desc: '座ったまま運河と内港、海側の風景を見て回る遊覧船。脚が重い日でも歩かずに観光できます。',
      detail:
        '船の上は風が強いです。運航時間・料金・天候による欠航は訪問前にご確認ください。',
      actionLabel: '乗船',
    },
    zh: {
      title: '坐船游运河一圈',
      short: '浦项运河游船',
      subtitle: '运河 → 东滨内港 往返',
      desc: '坐着就能欣赏运河、内港和海边风景的游船。腿沉的日子不用走路也能观光。',
      detail: '船上风很大。航班时间、票价以及是否因天气停航，请在出发前确认。',
      actionLabel: '乘船',
    },
  },
  'jd-canal': {
    en: {
      title: 'A short walk along the water',
      short: 'Canal walk',
      subtitle: 'Pohang Canal · flat path',
      desc: 'Stroll slowly along the flat path that follows the canal.',
      detail:
        "There are almost no slopes, so it's an easy walk even after your race.",
      actionLabel: 'Walk',
    },
    ja: {
      title: '水路沿いの短い散歩',
      short: '運河の遊歩道',
      subtitle: '浦項運河・平坦な道',
      desc: '運河に沿って続く平坦な遊歩道をゆっくり歩きましょう。',
      detail: '傾斜がほとんどないので、完走後でも歩きやすいです。',
      actionLabel: '散歩',
    },
    zh: {
      title: '沿水路短途散步',
      short: '运河步道',
      subtitle: '浦项运河 · 平坦道路',
      desc: '沿着运河旁平坦的步道慢慢走走。',
      detail: '几乎没有坡度，跑完全程后也走得轻松。',
      actionLabel: '散步',
    },
  },
  'jd-cafe': {
    en: {
      title: 'Rest at a canal-side café',
      short: 'Canal café',
      subtitle: 'Near the canal · café picks',
      desc: 'Take a short rest at a café with a view of the water before moving on.',
      detail: 'There are cafés along the canal. Hours vary by café.',
      actionLabel: 'Break',
    },
    ja: {
      title: '運河沿いのカフェでひと休み',
      short: '運河カフェ',
      subtitle: '運河周辺・カフェ候補',
      desc: '次の移動の前に、水路が見えるカフェで少し休みましょう。',
      detail: '運河沿いにカフェがあります。営業時間は店によって異なります。',
      actionLabel: '休憩',
    },
    zh: {
      title: '在运河边的咖啡馆休息',
      short: '运河咖啡馆',
      subtitle: '运河附近 · 咖啡馆推荐',
      desc: '在下一段行程前，到能看见水路的咖啡馆稍作休息。',
      detail: '运河沿岸有咖啡馆。营业时间因店而异。',
      actionLabel: '休息',
    },
  },
}

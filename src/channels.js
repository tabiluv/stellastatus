/**
 * 스텔라이브 멤버 로스터 및 치지직 채널 매핑.
 *
 * channelId는 치지직 채널 검색으로 확인한 인증(verified) 채널 기준이다.
 * 로스터 변경 시 이 파일을 수정하거나 ChzzkClient 생성 시 channels 옵션으로 덮어쓴다.
 */

export const STELLIVE_CHANNELS = {
  // 1기 — 에버리스 (EVERLASTING)
  'ayatsuno-yuni': {
    id: '45e71a76e949e16a34764deb962f9d9f',
    name: '아야츠노 유니',
    gen: 1,
    genName: '에버리스',
    aliases: ['유니', 'yuni', 'ayatsuno yuni', 'ayatsuno'],
  },
  'sakihane-fuya': {
    id: '36ddb9bb4f17593b60f1b63cec86611d',
    name: '사키하네 후야',
    gen: 1,
    genName: '에버리스',
    aliases: ['후야', 'fuya', 'sakihane fuya', 'sakihane'],
  },

  // 2기 — 유니버스 (UNIVERSE)
  'neneko-mashiro': {
    id: '4515b179f86b67b4981e16190817c580',
    name: '네네코 마시로',
    gen: 2,
    genName: '유니버스',
    aliases: ['마시로', 'mashiro', 'neneko mashiro', 'neneko'],
  },
  'akane-lize': {
    id: '4325b1d5bbc321fad3042306646e2e50',
    name: '아카네 리제',
    gen: 2,
    genName: '유니버스',
    aliases: ['리제', 'lize', 'akane lize', 'akane'],
  },
  'shirayuki-hina': {
    id: 'b044e3a3b9259246bc92e863e7d3f3b8',
    name: '시라유키 히나',
    gen: 2,
    genName: '유니버스',
    aliases: ['히나', 'hina', 'shirayuki hina', 'shirayuki'],
  },
  'arahashi-tabi': {
    id: 'a6c4ddb09cdb160478996007bff35296',
    name: '아라하시 타비',
    gen: 2,
    genName: '유니버스',
    aliases: ['타비', 'tabi', 'arahashi tabi', 'arahashi'],
  },

  // 3기 — 클리셰 (CLICHÉ)
  'tenko-shibuki': {
    id: '64d76089fba26b180d9c9e48a32600d9',
    name: '텐코 시부키',
    gen: 3,
    genName: '클리셰',
    aliases: ['시부키', '부키', 'shibuki', 'tenko shibuki', 'tenko'],
  },
  'hanako-nana': {
    id: '4d812b586ff63f8a2946e64fa860bbf5',
    name: '하나코 나나',
    gen: 3,
    genName: '클리셰',
    aliases: ['나나', 'nana', 'hanako nana', 'hanako'],
  },
  'yuzuha-riko': {
    id: '8fd39bb8de623317de90654718638b10',
    name: '유즈하 리코',
    gen: 3,
    genName: '클리셰',
    aliases: ['리코', 'riko', 'yuzuha riko', 'yuzuha'],
  },
  'aokumo-rin': {
    id: '516937b5f85cbf2249ce31b0ad046b0f',
    name: '아오쿠모 린',
    gen: 3,
    genName: '클리셰',
    aliases: ['린', 'rin', 'aokumo rin', 'aokumo'],
  },
};

/** 정규화: 공백 제거 + 소문자 */
function norm(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * 입력값(채널 key / 한글 이름 / 별칭 / 채널 ID)으로 로스터 항목을 찾습니다.
 * @param {string} input
 * @param {Record<string, object>} [channels]
 * @returns {{ key: string, id: string, name: string, gen: number, aliases: string[] } | null}
 */
export function resolveChannel(input, channels = STELLIVE_CHANNELS) {
  if (!input) return null;
  const target = norm(input);

  for (const [key, ch] of Object.entries(channels)) {
    if (norm(key) === target) return { key, ...ch };
    if (norm(ch.name) === target) return { key, ...ch };
    if (ch.id === input) return { key, ...ch };
    if ((ch.aliases || []).some((a) => norm(a) === target)) return { key, ...ch };
  }

  // 부분 일치(한글 이름에 포함) — "타비" 처럼 별칭에 없어도 이름 일부로 검색 가능
  for (const [key, ch] of Object.entries(channels)) {
    if (norm(ch.name).includes(target)) return { key, ...ch };
  }
  return null;
}

/** 로스터의 모든 채널을 배열로 반환 */
export function listChannels(channels = STELLIVE_CHANNELS) {
  return Object.entries(channels).map(([key, ch]) => ({ key, ...ch }));
}

/** 로스터에 등록된 모든 멤버의 한글 이름 목록 */
export function memberNames(channels = STELLIVE_CHANNELS) {
  return Object.values(channels).map((ch) => ch.name);
}

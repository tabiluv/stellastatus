import { STELLIVE_CHANNELS, resolveChannel, memberNames } from './channels.js';

/** HTML 태그 제거 */
export function stripHtml(input) {
  return String(input ?? '').replace(/<[^>]*>/g, '');
}

/** 주요 HTML 엔티티 디코드 */
export function decodeEntities(input) {
  return String(input ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** 태그 제거 + 엔티티 디코드 + 공백 정리 */
export function clean(input) {
  return decodeEntities(stripHtml(input)).replace(/[ \t]+/g, ' ').trim();
}

/**
 * 뱅온정보 본문에서 특정 아티스트에 관한 부분만 잘라냅니다.
 *
 * 동작 방식: 본문 안에서 등장하는 "모든 멤버 이름"의 위치를 찾아 경계로 삼고,
 * 대상 아티스트의 이름이 나타난 지점부터 다음 멤버가 등장하기 직전까지를 반환합니다.
 * 게시글 포맷(이모지 장식 등)에 상관없이 이름 위치 기준으로 분리하므로 견고합니다.
 *
 * @param {string} content 뱅온정보 게시글 본문(또는 검색 스니펫 등 임의의 텍스트)
 * @param {string} artist 채널 key / 한글 이름 / 별칭
 * @param {object} [options]
 * @param {Record<string, object>} [options.channels] 로스터 덮어쓰기
 * @returns {{ artist: string, matched: boolean, text: string }}
 */
export function extractArtistSection(content, artist, options = {}) {
  const channels = options.channels || STELLIVE_CHANNELS;
  const text = clean(content);
  const resolved = resolveChannel(artist, channels);
  const artistName = resolved?.name || String(artist).trim();

  if (!text) return { artist: artistName, matched: false, text: '' };

  // 본문에 등장하는 모든 멤버 이름의 위치를 수집 (경계로 사용)
  const names = memberNames(channels);
  const boundaries = [];
  for (const name of names) {
    const idx = text.indexOf(name);
    if (idx !== -1) boundaries.push({ name, idx });
  }
  boundaries.sort((a, b) => a.idx - b.idx);

  const start = boundaries.find((b) => b.name === artistName);
  if (!start) {
    return { artist: artistName, matched: false, text: '' };
  }

  const next = boundaries.find((b) => b.idx > start.idx);
  const section = text.slice(start.idx, next ? next.idx : undefined).trim();

  return { artist: artistName, matched: true, text: section };
}

/**
 * 뱅온정보 본문을 멤버별 구획으로 모두 분리합니다.
 * @returns {Record<string, string>} 한글 이름 → 해당 구획 텍스트
 */
export function extractAllArtistSections(content, options = {}) {
  const channels = options.channels || STELLIVE_CHANNELS;
  const text = clean(content);
  const names = memberNames(channels);

  const boundaries = [];
  for (const name of names) {
    const idx = text.indexOf(name);
    if (idx !== -1) boundaries.push({ name, idx });
  }
  boundaries.sort((a, b) => a.idx - b.idx);

  const result = {};
  boundaries.forEach((b, i) => {
    const end = boundaries[i + 1]?.idx;
    result[b.name] = text.slice(b.idx, end).trim();
  });
  return result;
}

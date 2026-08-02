import { STELLIVE_CHANNELS, resolveChannel, listChannels } from './channels.js';

const PUBLIC_API = 'https://api.chzzk.naver.com';
const OPEN_API = 'https://openapi.chzzk.naver.com';
const DEFAULT_UA = 'stellastatus';
const OFFLINE_MESSAGE = '방송 정보가 없습니다 (오프라인)';

/**
 * 치지직 방송 상태 클라이언트.
 *
 * 두 가지 동작 모드를 지원한다.
 * - 'public'(기본): 인증키 없이 채널별 라이브 상세(제목/카테고리/썸네일/시청자수)를 조회한다.
 * - 'official': 치지직 공식 오픈 API를 사용한다. Client-Id/Client-Secret이 필요하며,
 *   전체 라이브 목록을 순회하여 로스터의 채널을 매칭한다.
 */
export class ChzzkClient {
  /**
   * @param {object} [options]
   * @param {'public'|'official'} [options.mode] 동작 모드, 기본 'public'
   * @param {string} [options.clientId] 공식 오픈 API Client-Id ('official' 모드 필수)
   * @param {string} [options.clientSecret] 공식 오픈 API Client-Secret ('official' 모드 필수)
   * @param {Record<string, object>} [options.channels] 채널 로스터 덮어쓰기
   * @param {number} [options.thumbnailResolution] 썸네일 해상도(px), 기본 480
   * @param {number} [options.maxPages] 'official' 모드에서 순회할 라이브 목록 최대 페이지 수, 기본 10
   * @param {typeof fetch} [options.fetch] fetch 구현 주입
   * @param {string} [options.userAgent]
   */
  constructor(options = {}) {
    const {
      mode = 'public',
      clientId,
      clientSecret,
      channels = STELLIVE_CHANNELS,
      thumbnailResolution = 480,
      maxPages = 10,
      fetch: fetchImpl,
      userAgent = DEFAULT_UA,
    } = options;

    if (mode !== 'public' && mode !== 'official') {
      throw new Error(`알 수 없는 mode: "${mode}" ('public' 또는 'official')`);
    }
    if (mode === 'official' && (!clientId || !clientSecret)) {
      throw new Error(
        "'official' 모드에는 clientId와 clientSecret이 필요하다. " +
          'https://developers.chzzk.naver.com 에서 애플리케이션을 등록한다.',
      );
    }

    this.mode = mode;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.channels = channels;
    this.thumbnailResolution = thumbnailResolution;
    this.maxPages = maxPages;
    this.userAgent = userAgent;
    this._fetch = fetchImpl || globalThis.fetch;

    if (typeof this._fetch !== 'function') {
      throw new Error('fetch를 사용할 수 없다. Node 18 이상을 사용하거나 options.fetch를 주입한다.');
    }
  }

  async _request(url, headers) {
    const res = await this._fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`치지직 API 요청 실패 (${res.status} ${res.statusText}): ${url}`);
    }
    const json = await res.json();
    if (json.code && json.code !== 200) {
      throw new Error(`치지직 API 오류 (code ${json.code}): ${json.message || 'unknown'}`);
    }
    return json.content;
  }

  _publicHeaders() {
    return { 'User-Agent': this.userAgent, Accept: 'application/json' };
  }

  _officialHeaders() {
    return {
      'User-Agent': this.userAgent,
      Accept: 'application/json',
      'Client-Id': this.clientId,
      'Client-Secret': this.clientSecret,
    };
  }

  _resolveThumbnail(templateUrl) {
    if (!templateUrl) return null;
    return templateUrl.replace('{type}', String(this.thumbnailResolution));
  }

  _offline(channelId, meta = {}, extra = {}) {
    return {
      channel: {
        id: channelId,
        key: meta.key ?? null,
        name: meta.name ?? null,
        imageUrl: null,
        followerCount: null,
      },
      isLive: false,
      message: OFFLINE_MESSAGE,
      ...extra,
    };
  }

  // --- public 모드 ---------------------------------------------------------

  async _publicLiveDetail(channelId, meta = {}) {
    const url = `${PUBLIC_API}/service/v2/channels/${channelId}/live-detail`;
    const content = await this._request(url, this._publicHeaders());

    if (!content || content.status !== 'OPEN') {
      return this._offline(channelId, {
        key: meta.key,
        name: meta.name ?? content?.channel?.channelName ?? null,
      });
    }

    return {
      channel: {
        id: channelId,
        key: meta.key ?? null,
        name: meta.name ?? content.channel?.channelName ?? null,
        imageUrl: content.channel?.channelImageUrl ?? null,
        followerCount: content.channel?.followerCount ?? null,
      },
      isLive: true,
      liveId: content.liveId ?? null,
      title: content.liveTitle ?? null,
      category: content.liveCategoryValue || content.liveCategory || null,
      categoryType: content.categoryType ?? null,
      tags: content.tags ?? [],
      viewerCount: content.concurrentUserCount ?? null,
      openDate: content.openDate ?? null,
      adult: Boolean(content.adult),
      chatChannelId: content.chatChannelId ?? null,
      thumbnail: this._resolveThumbnail(content.liveImageUrl),
      liveUrl: `https://chzzk.naver.com/live/${channelId}`,
    };
  }

  /**
   * 치지직 채널 검색. 'public' 모드에서만 지원한다.
   * @param {string} keyword
   * @param {{ size?: number }} [options]
   */
  async searchChannels(keyword, { size = 5 } = {}) {
    if (this.mode !== 'public') {
      throw new Error("채널 검색은 'public' 모드에서만 지원한다(공식 오픈 API에는 채널 검색이 없다).");
    }
    const url = `${PUBLIC_API}/service/v1/search/channels?keyword=${encodeURIComponent(keyword)}&size=${size}`;
    const content = await this._request(url, this._publicHeaders());
    return (content?.data || []).map((d) => d.channel);
  }

  // --- official 모드 -------------------------------------------------------

  /**
   * 공식 오픈 API의 라이브 목록을 순회하여 channelId 기준 맵으로 반환한다.
   * @param {{ maxPages?: number }} [options]
   * @returns {Promise<Map<string, object>>}
   */
  async _officialLiveMap({ maxPages = this.maxPages } = {}) {
    const map = new Map();
    let next = null;

    for (let page = 0; page < maxPages; page += 1) {
      const params = new URLSearchParams({ size: '20' });
      if (next) params.set('next', next);
      const content = await this._request(
        `${OPEN_API}/open/v1/lives?${params.toString()}`,
        this._officialHeaders(),
      );
      const data = content?.data || [];
      for (const item of data) map.set(item.channelId, item);

      next = content?.page?.next || null;
      if (!next || data.length === 0) break;
    }
    return map;
  }

  _normalizeOfficialLive(item, meta = {}) {
    return {
      channel: {
        id: item.channelId,
        key: meta.key ?? null,
        name: meta.name ?? item.channelName ?? null,
        imageUrl: item.channelImageUrl ?? null,
        followerCount: null,
      },
      isLive: true,
      liveId: item.liveId ?? null,
      title: item.liveTitle ?? null,
      category: item.liveCategoryValue || item.liveCategory || null,
      categoryType: item.categoryType ?? null,
      tags: item.tags ?? [],
      viewerCount: item.concurrentUserCount ?? null,
      openDate: item.openDate ?? null,
      adult: Boolean(item.adult),
      chatChannelId: item.chatChannelId ?? null,
      thumbnail: this._resolveThumbnail(item.liveThumbnailImageUrl),
      liveUrl: `https://chzzk.naver.com/live/${item.channelId}`,
    };
  }

  /**
   * 공식 오픈 API로 채널 정보를 조회한다(라이브 상태가 아닌 채널 메타데이터).
   * 'official' 모드에서만 지원한다.
   * @param {string|string[]} channelIds 최대 20개
   */
  async getChannelInfo(channelIds) {
    if (this.mode !== 'official') {
      throw new Error("getChannelInfo는 'official' 모드에서만 지원한다.");
    }
    const ids = Array.isArray(channelIds) ? channelIds : [channelIds];
    const content = await this._request(
      `${OPEN_API}/open/v1/channels?channelIds=${ids.join(',')}`,
      this._officialHeaders(),
    );
    return content?.data || [];
  }

  // --- 공통 API ------------------------------------------------------------

  /**
   * 채널 ID로 방송 상태를 조회한다.
   * @param {string} channelId
   * @param {{ key?: string, name?: string }} [meta] 결과에 붙일 로스터 메타
   * @param {Map<string, object>|null} [liveMap] 'official' 모드에서 미리 조회한 라이브 맵(재사용)
   */
  async getLiveStatusByChannelId(channelId, meta = {}, liveMap = null) {
    if (this.mode === 'official') {
      const map = liveMap || (await this._officialLiveMap());
      const item = map.get(channelId);
      return item
        ? this._normalizeOfficialLive(item, { id: channelId, key: meta.key, name: meta.name })
        : this._offline(channelId, meta);
    }
    return this._publicLiveDetail(channelId, meta);
  }

  /**
   * 채널 key / 한글 이름 / 별칭 / 채널 ID로 방송 상태를 조회한다.
   * @param {string} nameOrId
   */
  async getLiveStatus(nameOrId) {
    const found = resolveChannel(nameOrId, this.channels);
    if (found) {
      return this.getLiveStatusByChannelId(found.id, { key: found.key, name: found.name });
    }
    if (/^[0-9a-f]{32}$/i.test(nameOrId)) {
      return this.getLiveStatusByChannelId(nameOrId);
    }
    throw new Error(`알 수 없는 채널: "${nameOrId}" (로스터에 없고 유효한 채널 ID도 아님)`);
  }

  /**
   * 로스터 전체 멤버의 방송 상태를 조회한다.
   * @returns {Promise<object[]>}
   */
  async getAllLiveStatuses() {
    const roster = listChannels(this.channels);

    if (this.mode === 'official') {
      const map = await this._officialLiveMap();
      return Promise.all(
        roster.map((ch) =>
          this.getLiveStatusByChannelId(ch.id, { key: ch.key, name: ch.name }, map),
        ),
      );
    }

    const results = await Promise.allSettled(
      roster.map((ch) => this._publicLiveDetail(ch.id, { key: ch.key, name: ch.name })),
    );
    return roster.map((ch, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') return r.value;
      return this._offline(ch.id, { key: ch.key, name: ch.name }, {
        error: r.reason?.message || String(r.reason),
        message: '조회 실패',
      });
    });
  }

  /**
   * 현재 방송 중인 멤버만 반환한다.
   * @returns {Promise<object[]>}
   */
  async getLiveMembers() {
    const all = await this.getAllLiveStatuses();
    return all.filter((s) => s.isLive);
  }
}

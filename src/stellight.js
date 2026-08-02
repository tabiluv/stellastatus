import { STELLIVE_CHANNELS, resolveChannel } from './channels.js';

const DEFAULT_BASE = 'https://stellight.fans/api/v1';
const DEFAULT_UA = 'stellastatus';

/**
 * 스텔라이브 방송 스케줄(뱅온정보) 클라이언트.
 *
 * 데이터 출처: StelLight (https://stellight.fans). 공개 API(/api/v1)를 사용하며 인증키가 필요 없다.
 */
export class StellightClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl] API 베이스 URL, 기본 https://stellight.fans/api/v1
   * @param {Record<string, object>} [options.channels] 채널 로스터(멤버 → 치지직 key 매핑용)
   * @param {typeof fetch} [options.fetch]
   * @param {string} [options.userAgent]
   */
  constructor(options = {}) {
    const {
      baseUrl = DEFAULT_BASE,
      channels = STELLIVE_CHANNELS,
      fetch: fetchImpl,
      userAgent = DEFAULT_UA,
    } = options;

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.channels = channels;
    this.userAgent = userAgent;
    this._fetch = fetchImpl || globalThis.fetch;
    this._stellarsPromise = null;

    if (typeof this._fetch !== 'function') {
      throw new Error('fetch 를 사용할 수 없습니다. Node 18+ 를 쓰거나 options.fetch 를 주입하세요.');
    }
  }

  async _get(path) {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`StelLight API 요청 실패 (${res.status} ${res.statusText}): ${path}`);
    }
    return res.json();
  }

  /**
   * 로컬 시간 기준 'YYYY-MM-DDTHH:mm:ss' 문자열로 변환.
   * @param {Date|string} value
   */
  static formatDateTime(value) {
    if (typeof value === 'string') return value;
    const p = (n) => String(n).padStart(2, '0');
    return (
      `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}` +
      `T${p(value.getHours())}:${p(value.getMinutes())}:${p(value.getSeconds())}`
    );
  }

  _normalize(item) {
    const name = item.stellarNameKor;
    const ch = resolveChannel(name, this.channels);
    return {
      id: item.id,
      stellarId: item.stellarId,
      stellarName: name,
      channelKey: ch?.key ?? null,
      startDateTime: item.startDateTime,
      isFixedTime: Boolean(item.isFixedTime),
      title: item.title,
      remark: item.remark ?? '',
    };
  }

  /**
   * 스텔라이브 멤버(스텔라) 목록. 인스턴스 내에서 1회 캐시한다.
   * @param {object} [options]
   * @param {boolean} [options.force] true면 캐시를 무시하고 다시 조회
   * @returns {Promise<Array<{ id, nameKor, nameEng, nameJpn, generation, isGraduated }>>}
   */
  async getStellars({ force = false } = {}) {
    if (force || !this._stellarsPromise) {
      this._stellarsPromise = this._get('/stellars').catch((err) => {
        this._stellarsPromise = null;
        throw err;
      });
    }
    return this._stellarsPromise;
  }

  /**
   * 채널 key / 한글 이름 / 별칭 / 스텔라 이름으로 stellarId를 찾는다.
   * @param {string|number} artist
   * @returns {Promise<number|null>}
   */
  async resolveStellarId(artist) {
    if (typeof artist === 'number') return artist;
    const found = resolveChannel(artist, this.channels);
    const name = (found?.name || String(artist).trim()).toLowerCase();
    const stellars = await this.getStellars();
    const hit = stellars.find(
      (s) =>
        s.nameKor?.toLowerCase() === name ||
        s.nameEng?.toLowerCase() === name,
    );
    return hit ? hit.id : null;
  }

  /**
   * 스케줄 조회(공식 파라미터). after/before/stellarId는 지정한 경우에만 서버로 전달한다.
   * @param {object} [params]
   * @param {Date|string} [params.after] startDateTimeAfter
   * @param {Date|string} [params.before] startDateTimeBefore
   * @param {number|number[]|string} [params.stellarId] 스텔라 필터(복수 가능)
   * @param {number} [params.size] 페이지당 개수, 기본 1000
   * @param {number} [params.page] 0-based 페이지, 기본 0
   * @param {boolean} [params.raw] true면 pagination 정보를 포함한 원본을 반환
   * @returns {Promise<object[]|object>} raw가 false면 정규화된 스케줄 배열
   */
  async getSchedules({ after, before, stellarId, size = 1000, page = 0, raw = false } = {}) {
    const qs = new URLSearchParams();
    if (after !== undefined) qs.set('startDateTimeAfter', StellightClient.formatDateTime(after));
    if (before !== undefined) qs.set('startDateTimeBefore', StellightClient.formatDateTime(before));
    if (stellarId !== undefined) {
      const ids = Array.isArray(stellarId) ? stellarId.join(',') : String(stellarId);
      qs.set('stellarId', ids);
    }
    qs.set('size', String(size));
    qs.set('page', String(page));

    const json = await this._get(`/schedules?${qs.toString()}`);
    if (raw) return json;

    const content = json.content || (Array.isArray(json) ? json : []);
    return content.map((it) => this._normalize(it));
  }

  /**
   * 특정 날짜(하루)의 전체 스케줄. 시작 시각 기준 오름차순 정렬.
   * @param {Date} [date] 기본 오늘
   */
  async getSchedulesByDate(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 0);
    const list = await this.getSchedules({ after: start, before: end });
    return list.sort((x, y) => x.startDateTime.localeCompare(y.startDateTime));
  }

  /**
   * 특정 멤버의 특정 날짜 스케줄만 반환한다.
   * stellarId로 서버에서 필터링하므로 전체를 받아 거르지 않는다.
   * @param {string|number} artist 채널 key / 한글 이름 / 별칭 / stellarId
   * @param {Date} [date] 기본 오늘
   */
  async getArtistSchedule(artist, date = new Date()) {
    const found = resolveChannel(artist, this.channels);
    const name = found?.name || String(artist).trim();
    const stellarId = await this.resolveStellarId(artist);

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 0);

    let items;
    if (stellarId != null) {
      items = await this.getSchedules({ after: start, before: end, stellarId });
    } else {
      const all = await this.getSchedules({ after: start, before: end });
      items = all.filter((s) => s.stellarName === name);
    }
    items.sort((x, y) => x.startDateTime.localeCompare(y.startDateTime));

    return {
      artist: name,
      stellarId: stellarId ?? null,
      date: StellightClient.formatDateTime(start).slice(0, 10),
      items,
    };
  }
}

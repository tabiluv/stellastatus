# stellastatus

스텔라이브 멤버의 치지직 방송 상태와 방송 스케줄(뱅온정보)을 조회하는 Node.js 라이브러리입니다.

- 치지직: 멤버별(또는 전체) 방송 여부, 제목, 카테고리, 썸네일, 시청자 수, 태그 조회
- 스케줄: 날짜별·멤버별 방송 예정/휴방 등 뱅온정보 조회

Node.js 18 이상이 필요합니다(전역 `fetch` 사용).

## 데이터 출처

- 방송 상태: 치지직(CHZZK)
- 방송 스케줄: **[StelLight](https://stellight.fans)** — 팬 제작 스텔라이브 스케줄 사이트입니다. 이 라이브러리의 스케줄 기능은 StelLight의 공개 API(`/api/v1`)를 사용합니다.

## 설치

```bash
npm install stellastatus
```

## 인증키

| 기능 | 필요한 키 | 발급처 |
| --- | --- | --- |
| 방송 스케줄 (StelLight) | 없음 | — |
| 치지직 방송 상태 (`public` 모드) | 없음 | — |
| 치지직 방송 상태 (`official` 모드) | Client-Id, Client-Secret | [치지직 개발자센터](https://developers.chzzk.naver.com) |

기본 사용에는 인증키가 필요 없습니다. 치지직 공식 오픈 API를 쓰는 `official` 모드에서만 키가 필요합니다.

## 빠른 시작

```js
import { createStellaStatus } from 'stellastatus';

const stella = createStellaStatus();

// 방송 상태 (치지직)
const tabi = await stella.chzzk.getLiveStatus('아라하시 타비');
if (tabi.isLive) {
  console.log(tabi.title, tabi.category, tabi.viewerCount, tabi.thumbnail);
} else {
  console.log(tabi.message);
}

// 방송 스케줄 (StelLight)
const today = await stella.schedule.getSchedulesByDate();
const tabiSchedule = await stella.schedule.getArtistSchedule('아라하시 타비');
console.log(tabiSchedule.items);
```

`createStellaStatus(config)` 는 `{ chzzk, schedule }` 을 반환합니다.

| config | 설명 |
| --- | --- |
| `config.chzzk` | `ChzzkClient` 옵션. 생략 시 `public` 모드 |
| `config.stellight` | `StellightClient` 옵션. 생략 가능 |

## 치지직

`ChzzkClient` 를 단독으로 사용할 수 있습니다.

```js
import { ChzzkClient } from 'stellastatus';

const chzzk = new ChzzkClient(); // public 모드
```

### 동작 모드

**`public` (기본)** — 인증키가 필요 없고, 채널별 라이브 상세를 직접 조회합니다.

**`official` (선택)** — 치지직 공식 오픈 API(`openapi.chzzk.naver.com`)를 사용합니다. Client-Id와 Client-Secret이 필요합니다.

```js
const chzzk = new ChzzkClient({
  mode: 'official',
  clientId: 'CHZZK_CLIENT_ID',
  clientSecret: 'CHZZK_CLIENT_SECRET',
});
```

공식 오픈 API에는 특정 채널의 라이브 상태를 직접 조회하는 엔드포인트가 없습니다. 시청자 수 상위 순으로 정렬된 전체 라이브 목록(`GET /open/v1/lives`, 페이지당 최대 20개)만 제공하므로, `official` 모드는 이 목록을 순회하며 로스터의 채널을 매칭합니다. 다음 한계가 있습니다.

- `maxPages` 범위(기본 10페이지 = 200채널) 밖의 채널은 오프라인으로 간주될 수 있습니다.
- 시청자 수가 낮거나 동시 라이브가 많은 시간대에는 매칭에서 누락될 수 있습니다.
- 채널 검색(`searchChannels`)은 지원하지 않습니다.

멤버별 방송 상태를 누락 없이 조회해야 한다면 `public` 모드를 사용하시기 바랍니다.

### 생성자 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `mode` | `'public'` | `'public'` 또는 `'official'` |
| `clientId`, `clientSecret` | — | `official` 모드 필수 |
| `channels` | 내장 로스터 | 로스터 덮어쓰기 |
| `thumbnailResolution` | `480` | 썸네일 해상도(px) |
| `maxPages` | `10` | `official` 모드 라이브 목록 순회 최대 페이지 수 |
| `fetch` | 전역 `fetch` | fetch 구현 주입 |

### 채널 지정

`getLiveStatus()` 는 다음 형태를 모두 받습니다.

- 채널 key: `'arahashi-tabi'`
- 한글 이름: `'아라하시 타비'`
- 별칭·부분 이름: `'타비'`, `'riko'`
- 치지직 채널 ID(32자): `'a6c4ddb09cdb160478996007bff35296'`

### 메서드

| 메서드 | 모드 | 설명 |
| --- | --- | --- |
| `getLiveStatus(nameOrId)` | 공통 | 특정 멤버의 방송 상태 |
| `getAllLiveStatuses()` | 공통 | 로스터 전체 멤버 상태 |
| `getLiveMembers()` | 공통 | 현재 방송 중인 멤버만 |
| `getLiveStatusByChannelId(channelId, meta?)` | 공통 | 채널 ID로 조회 |
| `searchChannels(keyword)` | public | 채널 검색(이름 → 채널 ID) |
| `getChannelInfo(channelIds)` | official | 채널 메타데이터 조회 |

### 반환 형태

방송 중일 때:

```js
{
  channel: { id, key, name, imageUrl, followerCount },
  isLive: true,
  liveId, title, category, categoryType, tags,
  viewerCount, openDate, adult, chatChannelId,
  thumbnail,   // 해상도 치환이 끝난 미리보기 URL
  liveUrl      // https://chzzk.naver.com/live/{id}
}
```

방송 중이 아닐 때:

```js
{
  channel: { id, key, name, imageUrl, followerCount },
  isLive: false,
  message: '방송 정보가 없습니다 (오프라인)'
}
```

## 스케줄 (뱅온정보)

방송 스케줄은 [StelLight](https://stellight.fans)의 공개 API(`/api/v1`)에서 가져옵니다. 인증키가 필요 없습니다.

```js
import { StellightClient } from 'stellastatus';

const schedule = new StellightClient();
```

### 메서드

| 메서드 | 설명 |
| --- | --- |
| `getSchedulesByDate(date?)` | 특정 날짜(기본 오늘) 전체 스케줄, 시작 시각 오름차순 |
| `getArtistSchedule(artist, date?)` | 특정 멤버의 해당 날짜 스케줄. `stellarId`로 서버에서 필터링 |
| `getSchedules({ after, before, stellarId?, size?, page?, raw? })` | 스케줄 조회(공식 파라미터). `raw: true`면 pagination 정보 포함 원본 반환 |
| `getStellars({ force? })` | 스텔라이브 멤버 목록(인스턴스 내 1회 캐시) |
| `resolveStellarId(artist)` | 채널 key/이름/별칭 → `stellarId` |

스케줄은 멤버별로 이미 분리되어 제공되므로, 특정 아티스트의 뱅온정보는 텍스트 파싱 없이 `getArtistSchedule()` 로 바로 얻을 수 있습니다. `getArtistSchedule()`은 `stellarId`로 서버에서 필터링하여 불필요한 데이터를 받지 않습니다.

`title`은 `'휴방'`, `'휴방*'`, `'늦방 or 휴방'` 등 다양한 값을 가질 수 있으므로, 제목만으로 방송 여부를 단정하지 않는 것이 좋습니다. 실시간 방송 여부는 치지직(`ChzzkClient`)으로 확인하시기 바랍니다.

### 반환 형태

각 스케줄 항목:

```js
{
  id,
  stellarId,
  stellarName,      // 예: '아라하시 타비'
  channelKey,       // 로스터에 있으면 치지직 채널 key, 없으면 null
  startDateTime,    // 'YYYY-MM-DDTHH:mm:ss'
  isFixedTime,      // 시간 확정 여부 (false면 '방송 예정'/'휴방' 등)
  title,            // 예: '저챗 + 세피리아 합방 (w. 후야, 타비, 린)'
  remark
}
```

`getArtistSchedule()` 반환:

```js
{ artist: '아라하시 타비', date: '2026-08-02', items: [ /* 위 항목 배열 */ ] }
```

## 로스터

기본 로스터는 [`src/channels.js`](src/channels.js) 에 정의돼 있으며, 치지직 인증(verified) 채널 ID를 사용합니다. 멤버 변경 시 이 파일을 수정하거나 생성 시 `channels` 옵션으로 덮어쓰면 됩니다.

```js
import { STELLIVE_CHANNELS, ChzzkClient } from 'stellastatus';

const chzzk = new ChzzkClient({
  channels: {
    ...STELLIVE_CHANNELS,
    'new-member': { id: '채널ID', name: '새 멤버', gen: 4, aliases: [] },
  },
});
```

기본 포함 멤버:

| 기수 | 멤버 |
| --- | --- |
| 1기 · 에버리스 | 아야츠노 유니, 사키하네 후야 |
| 2기 · 유니버스 | 네네코 마시로, 아카네 리제, 시라유키 히나, 아라하시 타비 |
| 3기 · 클리셰 | 텐코 시부키, 하나코 나나, 유즈하 리코, 아오쿠모 린 |

## 텍스트 유틸 (parser)

임의의 텍스트에서 멤버 구획을 분리하는 유틸도 제공합니다(멤버 이름 위치를 경계로 분리).

```js
import { extractArtistSection, clean } from 'stellastatus/parser';
```

`stripHtml`, `decodeEntities`, `clean`, `extractArtistSection`, `extractAllArtistSections` 를 포함합니다.

## 제작

- 제작자: 정타비사랑해
- 문의: [test.soft21c@gmail.com](mailto:test.soft21c@gmail.com)
- X : [@tabi_1uv](https://x.com/tabi_1uv)

## 감사

방송 스케줄 데이터는 [StelLight](https://stellight.fans)에서 제공합니다. API 활용을 허락해 주신 StelLight 개발자님께 감사드립니다.

## 라이선스

MIT

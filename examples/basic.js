/**
 * 실행: node examples/basic.js
 *
 * 치지직 방송 상태 조회('public' 모드)는 인증키 없이 동작한다.
 * 카페(뱅온정보) 조회는 네이버 키를 환경변수로 넣어야 한다.
 *
 *   NAVER_CLIENT_ID=xxx NAVER_CLIENT_SECRET=yyy node examples/basic.js
 */
import { createStellaStatus, ChzzkClient, extractArtistSection } from '../src/index.js';

async function main() {
  const chzzk = new ChzzkClient();

  console.log('[전체 멤버 방송 상태]');
  const all = await chzzk.getAllLiveStatuses();
  for (const s of all) {
    if (s.isLive) {
      console.log(`LIVE  ${s.channel.name} | ${s.title} | ${s.category} | ${s.viewerCount}명`);
    } else {
      console.log(`OFF   ${s.channel.name} | ${s.message}`);
    }
  }

  console.log('\n[특정 멤버: 아라하시 타비]');
  console.log(JSON.stringify(await chzzk.getLiveStatus('아라하시 타비'), null, 2));

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (clientId && clientSecret) {
    const stella = createStellaStatus({ naver: { clientId, clientSecret } });

    console.log('\n[최신 뱅온정보 게시글]');
    const post = await stella.cafe.getLatestBangonPost();
    console.log(post ? `${post.title}\n${post.link}` : '게시글을 찾지 못함');

    console.log('\n[유즈하 리코 관련 내용 분리]');
    console.log(await stella.cafe.getArtistBangon('유즈하 리코'));
  } else {
    console.log('\n네이버 키가 없어 카페 예제는 건너뛴다.');
  }

  console.log('\n[파서 데모]');
  const sample =
    '아라하시 타비 20시 뱅온 예정 텐코 시부키 오늘 휴방 시라유키 히나 21시 게임 방송';
  console.log(extractArtistSection(sample, '텐코 시부키'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

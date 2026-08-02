/**
 * 실 API 테스트. 아래 키만 채우고 실행한다.
 *
 *   node live-test.js   (또는 npm test)
 *
 * 치지직 public 모드와 스케줄(stellight.fans)은 키 없이 동작한다.
 * 치지직 official 모드를 테스트하려면 CHZZK_MODE를 'official'로 바꾸고 키를 채운다.
 */
import { ChzzkClient, StellightClient } from './src/index.js';

// ── 치지직 설정 (public 모드는 키 불필요) ──────────────────────────
const CHZZK_MODE = 'public'; // 'public' 또는 'official'
const CHZZK_CLIENT_ID = '';
const CHZZK_CLIENT_SECRET = '';
// ─────────────────────────────────────────────────────────────────

function line() {
  console.log('-'.repeat(60));
}

async function testChzzk() {
  const chzzk = new ChzzkClient({
    mode: CHZZK_MODE,
    clientId: CHZZK_CLIENT_ID || undefined,
    clientSecret: CHZZK_CLIENT_SECRET || undefined,
  });

  line();
  console.log(`치지직 (${chzzk.mode} 모드) - 전체 멤버 방송 상태`);
  line();

  const all = await chzzk.getAllLiveStatuses();
  for (const s of all) {
    if (s.isLive) {
      console.log(`LIVE  ${s.channel.name} | ${s.title} | ${s.category} | ${s.viewerCount}명`);
    } else {
      console.log(`OFF   ${s.channel.name} | ${s.message}`);
    }
  }
  console.log(`\n방송 중: ${all.filter((s) => s.isLive).length}명 / 전체 ${all.length}명`);
}

async function testSchedule() {
  const schedule = new StellightClient();

  line();
  console.log('스케줄 (뱅온정보) - 출처: StelLight (stellight.fans)');
  line();

  const today = await schedule.getSchedulesByDate();
  console.log(`오늘 스케줄 ${today.length}건`);
  for (const s of today) {
    const time = s.startDateTime.slice(11, 16);
    console.log(`  ${time} | ${s.stellarName} | ${s.title}${s.isFixedTime ? '' : ' (미정)'}`);
  }

  console.log('\n[특정 멤버: 아라하시 타비]');
  console.log(JSON.stringify(await schedule.getArtistSchedule('아라하시 타비'), null, 2));
}

async function main() {
  await testChzzk();
  await testSchedule();
  line();
  console.log('완료.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

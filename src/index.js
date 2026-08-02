import { ChzzkClient } from './chzzk.js';
import { StellightClient } from './stellight.js';

export { ChzzkClient } from './chzzk.js';
export { StellightClient } from './stellight.js';
export * from './channels.js';
export * from './parser.js';

/**
 * 치지직·스케줄 클라이언트를 함께 생성한다.
 *
 * @param {object} [config]
 * @param {object} [config.chzzk] ChzzkClient 옵션 { mode?, clientId?, clientSecret?, channels?, ... }
 * @param {object} [config.stellight] StellightClient 옵션 { baseUrl?, channels?, ... }
 * @returns {{ chzzk: ChzzkClient, schedule: StellightClient }}
 */
export function createStellaStatus(config = {}) {
  const { chzzk = {}, stellight = {} } = config;
  return {
    chzzk: new ChzzkClient(chzzk),
    schedule: new StellightClient(stellight),
  };
}

export default createStellaStatus;

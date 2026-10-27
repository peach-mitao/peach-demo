import {fileURLToPath} from 'node:url';
import {behaviorVersion} from './behavior_version.ts';
import {verifyBehavior} from './sync_behavior.ts';
import {checkBehaviorArtifacts} from './behavior_artifacts.ts';
import {demoPages} from './demo_pages.ts';
const directory=process.env.PEACH_BEHAVIOR_ARTIFACTS||fileURLToPath(new URL('../evidence/',import.meta.url));
await verifyBehavior(true);await checkBehaviorArtifacts(directory,'demo',await behaviorVersion(),await demoPages());
console.log('演示站追踪契约与参考图一致');

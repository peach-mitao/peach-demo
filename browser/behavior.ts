import {startBehavior} from './assets/behavior-core.ts';
import {demoRules,demoState} from './behavior-rules.ts';
import {layoutVersion} from './behavior-version.ts';
const local=['localhost','127.0.0.1'].includes(location.hostname);
startBehavior({site:'demo',layout:layoutVersion,endpoint:local?'http://127.0.0.1:8797/api/behavior':'https://peach.video/api/behavior',preview:local&&new URLSearchParams(location.search).has('behavior-preview'),rules:demoRules,state:demoState});

import {startBehavior} from './assets/behavior-core.ts';
import {demoRules,demoState} from './behavior-rules.ts';
import {layoutVersion} from './behavior-version.ts';
const local=['localhost','127.0.0.1'].includes(location.hostname);
// 自动演示的程序点击不作为真实访客动线。
if(!new URLSearchParams(location.search).has('tour'))startBehavior({site:'demo',layout:layoutVersion,endpoint:local?'http://127.0.0.1:8797/api/behavior':'https://peach.video/api/behavior',preview:local&&new URLSearchParams(location.search).has('behavior-preview'),rules:demoRules,state:demoState});

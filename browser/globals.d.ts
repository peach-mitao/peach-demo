interface CopyEditor {busy:boolean;editing:boolean;commit(cancel?:boolean):Promise<unknown>|void;hideHighlight():void}
interface CopyEditorOptions {highlight:HTMLElement;isActive():boolean;onStatus(message:string):void;onBusy?(busy:boolean):void;resolve(node:Text):object|null;save(edit:{node:Text;original:string},text:string):object|Promise<object>}
declare var PeachCopyEditorCore:{create(options:CopyEditorOptions):CopyEditor;applyDrafts(root:Node,edits:Record<string,string>,originals:WeakMap<Text,string>):void};
declare var peachDemoReplay:((request:Request)=>Promise<Response>)|undefined;
declare var peachDemoMedia:((value:string)=>string)|undefined;
declare var peachDemoMediaJSON:((value:unknown)=>unknown)|undefined;
declare var peachDemoTags:typeof import('../src/tag-management.ts');
interface Window {peachDemoTimelineFallbacks:number;__scrolling?:boolean}
interface Window {PEACH_ENTRY_REFERRER?:string;PEACH_LOCALE_REDIRECTING?:boolean;PeachBehavior?:{flush():Promise<void>;mark():void;stop():void;context():{site:string;version:string;page:string;viewport:string;state:string;lang:string};coverage():{tag:string;attributes:string[]}[]}}

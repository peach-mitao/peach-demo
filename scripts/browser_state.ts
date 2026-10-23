// 录制验收与分析截图共用当前可见内容的就绪判据。
export function contentReady(){
 const immerse=document.querySelector<HTMLElement>('[data-immerse]:not([hidden])');
 if(immerse)return Boolean((immerse.querySelector<HTMLVideoElement>('video')?.readyState||0)>=2);
 const scope=[...document.querySelectorAll<HTMLElement>('dialog[open],[role="dialog"][aria-modal="true"]')].find(element=>element.checkVisibility())||document;
 return ![...scope.querySelectorAll<HTMLElement>('[data-skeleton],[aria-busy="true"]')].some(element=>{const rect=element.getBoundingClientRect();return element.checkVisibility({opacityProperty:true})&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth});
}

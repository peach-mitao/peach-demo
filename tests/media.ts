export const videoKey='demo/videos/'+'a'.repeat(64)+'.mp4';
export function media(){
 const stats={indexes:0};
 const metadata={key:videoKey,size:8};
 const env={ASSETS:{fetch:async()=>{stats.indexes++;return Response.json({version:1,videos:{'1':metadata}})}}};
 return {env,stats,metadata};
}

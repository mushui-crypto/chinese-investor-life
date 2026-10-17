import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {existsSync} from 'node:fs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
let server;
const port=Number(process.env.PORT||4173),url=`http://127.0.0.1:${port}`;
function openBrowser(){const command=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';const args=process.platform==='win32'?['/c','start','',url]:[url];const child=spawn(command,args,{stdio:'ignore',detached:true});child.on('error',()=>console.log(`请打开 ${url}`));child.unref();}
try{const response=await fetch(url,{signal:AbortSignal.timeout(1000)});const text=await response.text();if(response.ok&&text.includes('中国式赌狗 · 一生的筹码')){console.log(`游戏已经运行：${url}`);openBrowser();process.exit(0);}throw Error('port occupied');}catch(e){if(e.message==='port occupied'){console.error(`端口 ${port} 已被其他程序占用。可用 PORT=4174 npm run launch 改用其他端口。`);process.exit(1);}}
server=spawn(process.execPath,['scripts/server.mjs'],{cwd:root,env:{...process.env,SERVE_DIST:existsSync(resolve(root,'index.html'))?'0':process.env.SERVE_DIST||'0'},stdio:['inherit','pipe','inherit']});
server.stdout.on('data',data=>{process.stdout.write(data);if(String(data).includes('http://'))openBrowser();});
server.on('error',error=>{console.error(error);process.exitCode=1;});
server.on('exit',code=>{process.exitCode=code||0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.kill(signal);});
console.log('关闭这个终端或按 Ctrl+C 可停止游戏服务。进度已经自动保存在浏览器。');

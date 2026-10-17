import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.env.SERVE_DIST==='1'?'dist':'.');
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost'); let name=decodeURIComponent(url.pathname);
  if(name==='/') name='/index.html';
  if(name.startsWith('/assets/')) name='/public'+name;
  const file=resolve(root,'.'+name);
  if(!(file.startsWith(root+sep))||!['GET','HEAD'].includes(req.method)) {res.writeHead(403);res.end('Forbidden');return;}
  const info=await stat(file); if(!info.isFile())throw Error('missing');
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:data);
 } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('没有找到这个页面');}
}).listen(port,'127.0.0.1',()=>console.log(`中国式赌狗 http://127.0.0.1:${port}`));

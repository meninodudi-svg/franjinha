// Servidor sem dependências: basta ter Node.js 18+ e rodar "node server.js"
const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||3000;
const SENHA=process.env.ADMIN_PASSWORD||"franjinha123"; // TROQUE a senha!
const DB=path.join(process.env.DATA_DIR||__dirname,"data.json"),PUB=path.join(__dirname,"public");
const PRECO={sedan:{cera:35,sem:30},suv:{cera:40,sem:35},cam:{cera:45,sem:40}};
const HORAS=[];for(let i=8;i<=17;i++)HORAS.push(String(i).padStart(2,"0")+":00");
const MIME={".html":"text/html; charset=utf-8",".webp":"image/webp",".png":"image/png",".css":"text/css",".js":"text/javascript"};
let items=[];try{items=JSON.parse(fs.readFileSync(DB,"utf8"))}catch(e){}
const save=()=>fs.writeFileSync(DB,JSON.stringify(items,null,1));
const send=(res,c,o)=>{res.writeHead(c,{"Content-Type":"application/json"});res.end(JSON.stringify(o))};
const body=req=>new Promise(r=>{let b="";req.on("data",d=>{b+=d;if(b.length>5000)req.destroy()});req.on("end",()=>{try{r(JSON.parse(b))}catch(e){r(null)}})});
const agoraBR=()=>new Date(Date.now()-3*3600e3).toISOString().slice(0,16); // horário de Brasília

http.createServer(async(req,res)=>{
  const u=new URL(req.url,"http://x"),p=u.pathname;
  if(p==="/api/horarios"&&req.method==="GET"){
    const d=u.searchParams.get("data");
    return send(res,200,{ocupados:items.filter(i=>i.data===d).map(i=>i.hora)});
  }
  if(p==="/api/agendar"&&req.method==="POST"){
    const b=await body(req);if(!b)return send(res,400,{erro:"Dados inválidos."});
    const nome=String(b.nome||"").trim().slice(0,60),tel=String(b.tel||"").replace(/\D/g,"");
    if(nome.length<2)return send(res,400,{erro:"Informe seu nome."});
    if(tel.length<10||tel.length>13)return send(res,400,{erro:"Informe um WhatsApp válido com DDD."});
    if(!PRECO[b.veic]||!PRECO[b.veic][b.serv])return send(res,400,{erro:"Serviço inválido."});
    if(!/^\d{4}-\d{2}-\d{2}$/.test(b.data)||!HORAS.includes(b.hora))return send(res,400,{erro:"Data ou horário inválido."});
    if(b.data+"T"+b.hora<=agoraBR())return send(res,400,{erro:"Esse horário já passou."});
    if(items.some(i=>i.data===b.data&&i.hora===b.hora))return send(res,409,{erro:"Esse horário acabou de ser ocupado."});
    const it={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),nome,tel,veic:b.veic,serv:b.serv,data:b.data,hora:b.hora,interna:b.interna===true,valor:PRECO[b.veic][b.serv]+(b.interna===true?15:0),feito:false,criado:new Date().toISOString()};
    items.push(it);save();return send(res,201,{ok:true});
  }
  if(p.startsWith("/api/admin")){
    if(req.headers["x-senha"]!==SENHA)return send(res,401,{erro:"Senha incorreta."});
    if(p==="/api/admin/agendamentos"&&req.method==="GET")
      return send(res,200,items.slice().sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora)));
    const id=p.split("/")[3],i=items.findIndex(x=>x.id===id);
    if(i<0)return send(res,404,{erro:"Não encontrado."});
    if(req.method==="PATCH"){items[i].feito=!items[i].feito;save();return send(res,200,{ok:true})}
    if(req.method==="DELETE"){items.splice(i,1);save();return send(res,200,{ok:true})}
  }
  // arquivos estáticos
  let f=path.join(PUB,p==="/"?"index.html":p==="/admin"?"admin.html":p);
  if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end("Não encontrado")}
  res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);
}).listen(PORT,()=>console.log("Site: http://localhost:"+PORT+"  |  Painel: http://localhost:"+PORT+"/admin"));

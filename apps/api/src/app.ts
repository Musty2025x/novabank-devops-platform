import express,{Request,Response,NextFunction} from "express";
import cors from "cors"; import helmet from "helmet"; import rateLimit from "express-rate-limit";
import {Prisma,PrismaClient} from "@prisma/client"; import {Counter,Histogram,Registry,collectDefaultMetrics} from "prom-client"; import {z} from "zod";
import {centsToMoney,parseMoneyToCents} from "./money";
export const prisma=new PrismaClient(); export const registry=new Registry(); collectDefaultMetrics({register:registry});
const requests=new Counter({name:"novabank_http_requests_total",help:"HTTP requests",labelNames:["method","route","status"],registers:[registry]});
const latency=new Histogram({name:"novabank_http_request_duration_seconds",help:"Request duration",labelNames:["method","route"],registers:[registry]});
export function createApp(db:PrismaClient=prisma){
 const app=express(); app.disable("x-powered-by"); app.use(helmet());
 app.use(cors({origin:(process.env.CORS_ORIGIN||"http://localhost:8080").split(",").map(s=>s.trim()),methods:["GET","POST"],allowedHeaders:["Content-Type","Idempotency-Key"]}));
 app.use(express.json({limit:"16kb"})); app.use(rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}));
 app.use((req,res,next)=>{const end=latency.startTimer({method:req.method,route:req.path});res.on("finish",()=>{end();requests.inc({method:req.method,route:req.route?.path||req.path,status:String(res.statusCode)});});next();});
 app.get("/health",(_req,res)=>res.json({status:"ok",service:"novabank-api"}));
 app.get("/ready",async(_req,res)=>{try{await db.$queryRaw`SELECT 1`;res.json({status:"ready",database:"connected"});}catch{res.status(503).json({status:"not_ready"});}});
 app.get("/metrics",async(_req,res)=>{res.setHeader("Content-Type",registry.contentType);res.end(await registry.metrics());});
 app.get("/api/v1/accounts",async(_req,res,next)=>{try{const rows=await db.account.findMany({orderBy:{createdAt:"asc"}});res.json({data:rows.map(a=>({id:a.id,displayName:a.displayName,accountNumber:a.accountNumber,currency:a.currency,balance:centsToMoney(a.balanceCents),status:a.status}))});}catch(e){next(e);}});
 app.get("/api/v1/accounts/:id/transactions",async(req,res,next)=>{try{const account=await db.account.findUnique({where:{id:req.params.id}});if(!account)return res.status(404).json({error:{code:"ACCOUNT_NOT_FOUND",message:"Account not found."}});const rows=await db.ledgerEntry.findMany({where:{accountId:account.id},include:{transfer:true},orderBy:{createdAt:"desc"},take:50});res.json({data:rows.map(e=>({id:e.id,transferId:e.transferId,direction:e.direction,amount:centsToMoney(e.amountCents),currency:e.transfer.currency,description:e.transfer.description,createdAt:e.createdAt.toISOString()}))});}catch(e){next(e);}});
 const schema=z.object({fromAccountId:z.string().min(1).max(64),toAccountId:z.string().min(1).max(64),amount:z.string().max(12),currency:z.string().length(3).transform(s=>s.toUpperCase()),description:z.string().trim().min(1).max(120)}).strict();
 app.post("/api/v1/transfers",async(req,res,next)=>{
  const key=req.header("Idempotency-Key");if(!key||key.length<8||key.length>128)return res.status(400).json({error:{code:"IDEMPOTENCY_KEY_REQUIRED",message:"Provide an Idempotency-Key between 8 and 128 characters."}});
  const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:{code:"INVALID_REQUEST",message:"Invalid transfer request.",details:parsed.error.flatten()}});
  const input=parsed.data;let cents:bigint;try{cents=parseMoneyToCents(input.amount);}catch(e){return res.status(400).json({error:{code:"INVALID_AMOUNT",message:e instanceof Error?e.message:"Invalid amount."}});}
  if(input.fromAccountId===input.toAccountId)return res.status(400).json({error:{code:"SAME_ACCOUNT",message:"Source and destination must differ."}});
  const fingerprint=JSON.stringify({...input,amount:centsToMoney(cents)});
  try{
   const existing=await db.transfer.findUnique({where:{idempotencyKey:key}});
   if(existing){if(existing.requestFingerprint!==fingerprint)return res.status(409).json({error:{code:"IDEMPOTENCY_CONFLICT",message:"Key already used with a different request."}});return res.status(200).json({data:{id:existing.id,status:existing.status,amount:centsToMoney(existing.amountCents),currency:existing.currency,replayed:true}});}
   const transfer=await db.$transaction(async tx=>{
    const ids=[input.fromAccountId,input.toAccountId].sort();
    const locked=await tx.$queryRaw<Array<{id:string;balanceCents:bigint;currency:string;status:string}>>`SELECT "id","balanceCents","currency","status" FROM "Account" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
    if(locked.length!==2)throw Object.assign(new Error("Account not found."),{code:"ACCOUNT_NOT_FOUND"});
    const source=locked.find(a=>a.id===input.fromAccountId)!;const dest=locked.find(a=>a.id===input.toAccountId)!;
    if(source.status!=="ACTIVE"||dest.status!=="ACTIVE")throw Object.assign(new Error("Both accounts must be active."),{code:"ACCOUNT_INACTIVE"});
    if(source.currency!==input.currency||dest.currency!==input.currency)throw Object.assign(new Error("Currency does not match both accounts."),{code:"CURRENCY_MISMATCH"});
    if(source.balanceCents<cents)throw Object.assign(new Error("Insufficient funds."),{code:"INSUFFICIENT_FUNDS"});
    await tx.account.update({where:{id:source.id},data:{balanceCents:{decrement:cents}}});await tx.account.update({where:{id:dest.id},data:{balanceCents:{increment:cents}}});
    const t=await tx.transfer.create({data:{fromAccountId:source.id,toAccountId:dest.id,amountCents:cents,currency:input.currency,description:input.description,idempotencyKey:key,requestFingerprint:fingerprint,status:"COMPLETED"}});
    await tx.ledgerEntry.createMany({data:[{accountId:source.id,transferId:t.id,direction:"DEBIT",amountCents:cents},{accountId:dest.id,transferId:t.id,direction:"CREDIT",amountCents:cents}]});return t;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:10000});
   res.status(201).json({data:{id:transfer.id,status:transfer.status,amount:centsToMoney(transfer.amountCents),currency:transfer.currency,replayed:false}});
  }catch(err){const e=err as Error&{code?:string};if(e.code==="P2002"){const prior=await db.transfer.findUnique({where:{idempotencyKey:key}}).catch(()=>null);if(prior?.requestFingerprint===fingerprint)return res.status(200).json({data:{id:prior.id,status:prior.status,amount:centsToMoney(prior.amountCents),currency:prior.currency,replayed:true}});return res.status(409).json({error:{code:"IDEMPOTENCY_CONFLICT",message:"Idempotency key conflict."}});}
   const known=["ACCOUNT_NOT_FOUND","ACCOUNT_INACTIVE","CURRENCY_MISMATCH","INSUFFICIENT_FUNDS"];if(e.code&&known.includes(e.code))return res.status(e.code==="ACCOUNT_NOT_FOUND"?404:422).json({error:{code:e.code,message:e.message}});
   if(err instanceof Prisma.PrismaClientKnownRequestError&&err.code==="P2034")return res.status(409).json({error:{code:"TRANSACTION_RETRY",message:"Concurrent transfer conflict; retry using the same idempotency key."}});next(err);}
 });
 app.use((_req,res)=>res.status(404).json({error:{code:"NOT_FOUND",message:"Route not found."}}));
 app.use((err:Error,_req:Request,res:Response,_next:NextFunction)=>{console.error("Unhandled request error:",err.message);if(!res.headersSent)res.status(500).json({error:{code:"INTERNAL_ERROR",message:"An unexpected error occurred."}});});
 return app;
}

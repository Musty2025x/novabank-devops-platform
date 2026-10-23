import {createApp,prisma} from "./app";
const port=Number(process.env.PORT||3000);const server=createApp().listen(port,"0.0.0.0",()=>console.info(`NovaBank API listening on ${port}`));
async function shutdown(signal:string){console.info(`${signal} received`);server.close(async()=>{await prisma.$disconnect();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on("SIGTERM",()=>void shutdown("SIGTERM"));process.on("SIGINT",()=>void shutdown("SIGINT"));

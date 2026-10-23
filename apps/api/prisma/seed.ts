import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
 const accounts = [
  {id:"demo-checking",displayName:"Demo Checking",accountNumber:"100000001",currency:"USD",balanceCents:250000n},
  {id:"demo-savings",displayName:"Demo Savings",accountNumber:"100000002",currency:"USD",balanceCents:1250000n},
  {id:"demo-business",displayName:"Demo Business",accountNumber:"100000003",currency:"USD",balanceCents:4500000n}
 ];
 for (const a of accounts) await prisma.account.upsert({where:{id:a.id},update:{displayName:a.displayName,accountNumber:a.accountNumber,currency:a.currency},create:a});
 console.info("Seeded fictional NovaBank accounts.");
}
main().finally(()=>prisma.$disconnect());

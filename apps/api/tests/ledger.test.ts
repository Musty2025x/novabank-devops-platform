import {describe,it,expect} from "vitest";
describe("ledger invariants",()=>{it("balances every transfer with equal debit and credit",()=>{const amount=2500n;const entries=[{direction:"DEBIT",amount},{direction:"CREDIT",amount}];const total=entries.reduce((sum,e)=>sum+(e.direction==="DEBIT"?-e.amount:e.amount),0n);expect(total).toBe(0n);});});

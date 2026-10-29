// Tally voucher XML → ledger lines: item invoices (purchase ledger inside inventory allocations) and round-off lines
// must balance exactly as they do in Tally.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTallyVouchers } from "../../src/lib/tallyUtils";

const sum = (lines: { amount: number; isDeemed: boolean }[], dr: boolean) => Math.round(lines.filter(l => l.isDeemed === dr).reduce((s, l) => s + l.amount, 0) * 100) / 100;

// Anonymised item-invoice purchase: party Cr 2197, Purchase (inventory allocation) Dr 1861.94, GST Dr 335.06+0.44? —
// Tally writes debits as negative AMOUNTs and credits as positive, with a round-off credit of 0.44.
const ITEM_INVOICE = `<ENVELOPE><VOUCHER REMOTEID="abc-1" VCHTYPE="Purchase"><DATE>20250405</DATE><VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME><VOUCHERNUMBER>5</VOUCHERNUMBER>
<ALLLEDGERENTRIES.LIST><LEDGERNAME>Asha Traders</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>2197.00</AMOUNT>
  <BILLALLOCATIONS.LIST><NAME>INV-77</NAME><AMOUNT>2197.00</AMOUNT></BILLALLOCATIONS.LIST></ALLLEDGERENTRIES.LIST>
<ALLLEDGERENTRIES.LIST><LEDGERNAME>Input CGST</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-167.72</AMOUNT></ALLLEDGERENTRIES.LIST>
<ALLLEDGERENTRIES.LIST><LEDGERNAME>Input SGST</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-167.72</AMOUNT></ALLLEDGERENTRIES.LIST>
<ALLLEDGERENTRIES.LIST><LEDGERNAME>Round Off</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>0.44</AMOUNT></ALLLEDGERENTRIES.LIST>
<ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>Copier paper</STOCKITEMNAME><AMOUNT>-1862.00</AMOUNT>
  <ACCOUNTINGALLOCATIONS.LIST><LEDGERNAME>Purchase 18%</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-1862.00</AMOUNT></ACCOUNTINGALLOCATIONS.LIST>
</ALLINVENTORYENTRIES.LIST>
</VOUCHER></ENVELOPE>`;

test("item invoice: purchase ledger read from inventory allocations", () => {
  const [v] = parseTallyVouchers(ITEM_INVOICE);
  assert.ok(v.lines.some(l => l.ledgerName === "Purchase 18%" && l.isDeemed && l.amount === 1862));
});

test("round-off with a positive amount is a credit even when ISDEEMEDPOSITIVE says Yes", () => {
  const [v] = parseTallyVouchers(ITEM_INVOICE);
  const ro = v.lines.find(l => l.ledgerName === "Round Off")!;
  assert.equal(ro.isDeemed, false);
});

test("the voucher balances as it does in Tally", () => {
  const [v] = parseTallyVouchers(ITEM_INVOICE);
  assert.equal(sum(v.lines, true), 2197.44);
  assert.equal(sum(v.lines, false), 2197.44);
});

test("bill allocations inside a ledger line are not counted as extra lines", () => {
  const [v] = parseTallyVouchers(ITEM_INVOICE);
  assert.equal(v.lines.filter(l => l.ledgerName === "Asha Traders").length, 1);
  assert.equal(v.lines.length, 5);
});

test("plain journal still reads by sign", () => {
  const [v] = parseTallyVouchers(`<VOUCHER><DATE>20250410</DATE><VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>Rent</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-25000.00</AMOUNT></ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>HDFC Bank</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>25000.00</AMOUNT></ALLLEDGERENTRIES.LIST></VOUCHER>`);
  assert.deepEqual(v.lines.map(l => [l.ledgerName, l.isDeemed]), [["Rent", true], ["HDFC Bank", false]]);
});

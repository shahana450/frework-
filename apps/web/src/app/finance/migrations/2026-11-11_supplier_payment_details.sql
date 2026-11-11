-- Supplier payment details for "Pay now" on Payables: UPI ID and bank account (shown to you to pay; FreBook never
-- moves money itself). Adds nullable columns only. Safe to run more than once.
alter table fw_fin_contacts add column if not exists upi_id       text;
alter table fw_fin_contacts add column if not exists bank_name    text;
alter table fw_fin_contacts add column if not exists bank_account text;
alter table fw_fin_contacts add column if not exists bank_ifsc    text;

# Legal page drafts (for owner and lawyer review)

These are drafts only. The live `/terms`, `/privacy` and `/refund-policy` pages have **not** been changed, because they name an entity ("FreWork Business Solutions") and give timelines the brief says must not be invented. Once the owner fills every `{{…}}`, a lawyer should review the text before it replaces the live pages.

Placeholders used: `{{LEGAL_ENTITY_NAME}}`, `{{CIN}}`, `{{GSTIN}}`, `{{REGISTERED_ADDRESS}}`, `{{JURISDICTION_CITY}}`, `{{AI_PROVIDER}}`, `{{GRIEVANCE_OFFICER_NAME}}`, `{{EMAIL}}`, `{{REFUND_WINDOW_DAYS}}`, `{{EFFECTIVE_DATE}}`.

---

## 1. Terms of Service

**Effective date:** {{EFFECTIVE_DATE}}

1. **Who we are.** frework.online ("FreWork") is operated by {{LEGAL_ENTITY_NAME}}, CIN {{CIN}}, GSTIN {{GSTIN}}, registered office at {{REGISTERED_ADDRESS}}.
2. **The service.** FreWork provides:
   - software for bookkeeping, including FreBook, the chat bookkeeping assistant;
   - compliance tracking;
   - ordering of professional services from independent professionals.
3. **AI-prepared entries.** FreBook uses an AI model from {{AI_PROVIDER}} to draft accounting entries. Every draft is shown to you before posting, and nothing is posted until you confirm it. You remain responsible for the accuracy of your books and your statutory filings.
4. **Not professional advice.** Output from the software is not legal, tax or audit advice. Advice is given only under a separate service order, by the professional named on that order.
5. **Your account.** Keep your login secure. You may not use FreWork for unlawful purposes or try to reach another user's data.
6. **Fees.** Fees are the prices shown at checkout, inclusive or exclusive of GST as stated there. Refunds follow the Refund Policy.
7. **Your data.** You own the data you enter. See the Privacy Policy.
8. **Liability.** To the extent the law allows, our total liability is limited to the fees you paid in the 12 months before the claim.
9. **Governing law.** These terms are governed by the laws of India. Courts at {{JURISDICTION_CITY}} have exclusive jurisdiction.
10. **Grievances.** See section 2.8.

## 2. Privacy Policy

**Effective date:** {{EFFECTIVE_DATE}}

1. **Data controller (data fiduciary).** {{LEGAL_ENTITY_NAME}}, {{REGISTERED_ADDRESS}}.
2. **What we collect.**
   - Account details: name, email and phone.
   - Business details: name, GSTIN and PAN, if you enter them.
   - Accounting data: vouchers, ledgers, uploaded statements and trial balances.
   - Payment references. We never see card or UPI credentials.
   - Usage logs.
3. **What we do not store.** Passwords for the GST portal, the Income-tax portal or your bank.
4. **Why we use it.**
   - To run the service.
   - To prepare entries you ask for.
   - For support.
   - For billing.
   - For legal compliance.
5. **AI processing.** The text of your FreBook chat, and the ledger names needed to draft an entry, are sent to {{AI_PROVIDER}} to produce a draft. *(Owner: confirm the provider's data-retention and training terms before publishing.)*
6. **Sharing.** We share data only with the processors that run the service (hosting, database, payments and the AI provider), with a professional you place an order with, or where the law requires it. We do not sell personal data.
7. **Your rights.** You may ask to access, correct or erase your data, or withdraw consent, by writing to {{EMAIL}}. *(The in-app data export and "delete business" flows are not built yet; see REPORT.md.)*
8. **Grievance Officer.** {{GRIEVANCE_OFFICER_NAME}}, {{EMAIL}}, {{REGISTERED_ADDRESS}}. We will acknowledge a complaint within 48 hours. *(Owner: confirm that this matches the Consumer Protection (E-Commerce) Rules and the DPDP Act timelines.)* We will resolve it within 90 days.
9. **Retention.** Accounting records are kept for as long as your account is active and afterwards for the period that Indian tax law requires. *(Owner/lawyer: confirm the period.)*

## 3. Refund Policy

**Effective date:** {{EFFECTIVE_DATE}}

The current live page states two different windows: 48 hours for service orders and 7 days for annual plans. The draft below uses **one rule**. The window is left to the owner.

1. **One rule.** You can ask for a full refund within {{REFUND_WINDOW_DAYS}} days of payment, as long as no work has started on the order and no government filing has been made.
2. **Never refundable.** Government fees, stamp duty and statutory charges paid on your behalf.
3. **Duplicate charges.** These are always refunded in full.
4. **How to ask.** Write to {{EMAIL}} with your order ID.
5. **Timeline.** Approved refunds go back to the original payment method within 5–7 business days. *(Owner: confirm this against PhonePe's settlement terms.)*
6. **FreBook subscription.**
   - You can cancel at any time, and access continues to the end of the paid period.
   - The billing schedule (monthly or annual) and the price are {{FREBOOK_PRICE_SCHEDULE}}. *(Pricing is an open owner decision; see REPORT.md.)*

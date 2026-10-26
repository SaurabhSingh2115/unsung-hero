# Billing v2 — Launch Report
Owner: Arjun Mehta. Launched: Oct 10, 2026.

## Summary
Billing v2 replaces the legacy invoicing pipeline with an event-driven, idempotent system.

## Impact
Billing v2 reduced invoice failures from 4.1% to 0.6%, affecting 1.2 million merchants.
Finance estimates the reduction in failed collections saves approximately $2.3M annually.
Support tickets about invoices dropped by 41% in the first two weeks.

## Scope & complexity
Zero-downtime migration of the ledger schema (2.1B rows), new retry/idempotency model,
cross-team dependencies with Tax, Finance and Notifications, PCI compliance review.

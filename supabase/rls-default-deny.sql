-- Default-deny Row Level Security for the Xenon schema.
--
-- WHY: Supabase exposes `public` tables through its auto-generated REST API to
-- anyone holding the project's anon key. Xenon never uses that path — all data
-- access goes through Prisma server-side with app-layer authorization
-- (CLAUDE.md Rule 5). Enabling RLS with NO policies blocks the REST/anon path
-- entirely (default deny) while leaving Prisma unaffected: it connects as the
-- `postgres` role, which owns these tables, and table owners bypass RLS unless
-- FORCE is set (we deliberately do not set FORCE).
--
-- REVERT: replace ENABLE with DISABLE for any table.

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientProject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientPortalUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MagicLinkToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Approval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgentAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgentUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WhiteLabelSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarketplaceIntegration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarketplaceOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ReferralConversion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProcessedStripeEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkspaceInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Briefing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Proposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Verification (run as the `postgres` role — the same role Prisma uses):
--   INSERT INTO public."ProcessedStripeEvent" (id, type) VALUES ('rls_probe', 'probe');
--   DELETE FROM public."ProcessedStripeEvent" WHERE id = 'rls_probe';
-- Both must succeed (owner bypass). The anon-key REST path must now return
-- zero rows / permission errors for every table.

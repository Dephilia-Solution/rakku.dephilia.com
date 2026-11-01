import { cache } from "react";
import { createAdminClient } from "@rakku/db";
import { getUsageSummary } from "@rakku/plans";

export const getOwnerUsage = cache((companyId: string) => getUsageSummary(createAdminClient(), companyId));

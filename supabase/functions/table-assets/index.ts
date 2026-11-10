import { createAssetHandler } from "./handler.ts";
import { deployedBackend } from "../../../src/lib/deployment.ts";
Deno.serve(
  createAssetHandler({
    url: Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    publicKey: deployedBackend.VITE_SUPABASE_PUBLISHABLE_KEY,
  }),
);

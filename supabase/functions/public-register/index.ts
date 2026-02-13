/// <reference types="https://deno.land/x/types@v0.1.0/deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  form: {
    name: string;
    phone: string;
    birth_date: string;

    baptized: boolean;
    baptism_contact: boolean | null;

    zone: string;

    address_opt_in: boolean;
    wants_visit: boolean;

    street: string | null;
    house_number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    reference: string | null;

    wants_ministry: boolean;
    wants_cell: boolean;

    // ✅ vamos aceitar os dois padrões
    declaration_true?: boolean;   // padrão antigo
    consent_internal?: boolean;   // padrão antigo

    consent_truth?: boolean;      // padrão novo
    consent_data?: boolean;       // padrão novo
  };
  selectedMinistries?: string[]; // ids
  selectedCell?: string | null;  // id
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(v: string) {
  return (v || "").replace(/\D/g, "");
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(500, {
        ok: false,
        error: "Missing env vars: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const payload = (await req.json()) as Payload;
    if (!payload?.form) return json(400, { ok: false, error: "Missing form" });

    const f = payload.form;

    // validações mínimas
    if (!f.name || f.name.trim().length < 3) return json(400, { ok: false, error: "Nome inválido" });

    const phoneDigits = normalizePhone(f.phone);
    if (!phoneDigits || phoneDigits.length < 10) return json(400, { ok: false, error: "Telefone inválido" });

    if (!f.birth_date) return json(400, { ok: false, error: "Nascimento obrigatório" });
    if (!f.zone || !f.zone.trim()) return json(400, { ok: false, error: "Zona obrigatória" });

    if (typeof f.baptized !== "boolean") return json(400, { ok: false, error: "Batismo inválido" });
    if (f.baptized === false && typeof f.baptism_contact !== "boolean") {
      return json(400, { ok: false, error: "Interesse no batismo obrigatório" });
    }

    if (f.wants_visit && !f.address_opt_in) {
      return json(400, { ok: false, error: "Visita requer endereço" });
    }

    // ✅ Checkboxes: aceita padrão antigo OU novo
    const declaration_true = (f.declaration_true === true) || (f.consent_truth === true);
    const consent_internal = (f.consent_internal === true) || (f.consent_data === true);

    if (!declaration_true || !consent_internal) {
      return json(400, { ok: false, error: "Confirmações obrigatórias" });
    }

    // 1) Insere pessoa
    const { data: person, error: personErr } = await sb
      .from("people")
      .insert({
        name: f.name.trim(),
        phone: phoneDigits, // ✅ salva limpinho
        birth_date: f.birth_date,

        baptized: f.baptized,
        baptism_contact: f.baptized ? null : f.baptism_contact,

        zone: f.zone.trim(),

        address_opt_in: f.address_opt_in,
        wants_visit: f.address_opt_in ? f.wants_visit : false,

        street: f.address_opt_in ? f.street : null,
        house_number: f.address_opt_in ? f.house_number : null,
        complement: f.address_opt_in ? f.complement : null,
        neighborhood: f.address_opt_in ? f.neighborhood : null,
        city: f.address_opt_in ? f.city : null,
        reference: f.address_opt_in ? f.reference : null,

        wants_ministry: !!f.wants_ministry,
        wants_cell: !!f.wants_cell,

        // ✅ salva flags de consentimento
        declaration_true,
        consent_internal,
      })
      .select("id")
      .single();

    if (personErr) {
      return json(500, { ok: false, error: "Insert people failed", detail: personErr.message });
    }

    const person_id = person.id as string;

    // 2) Ministérios
    const ministryIds = Array.isArray(payload.selectedMinistries) ? payload.selectedMinistries : [];
    if (ministryIds.length > 0) {
      const rows = ministryIds.map((ministry_id) => ({ person_id, ministry_id }));
      const { error: pmErr } = await sb.from("people_ministries").insert(rows);
      if (pmErr) {
        return json(500, { ok: false, error: "Insert people_ministries failed", detail: pmErr.message });
      }
    }

    // 3) Célula
    if (payload.selectedCell) {
      const { error: pcErr } = await sb.from("people_cells").insert({
        person_id,
        cell_id: payload.selectedCell,
      });
      if (pcErr) {
        return json(500, { ok: false, error: "Insert people_cells failed", detail: pcErr.message });
      }
    }

    return json(200, { ok: true, id: person_id });
  } catch (e) {
    return json(500, { ok: false, error: "Unhandled", detail: String(e?.message ?? e) });
  }
});

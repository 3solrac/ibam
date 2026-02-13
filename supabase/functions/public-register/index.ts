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

    declaration_true?: boolean; // antigo
    consent_internal?: boolean; // antigo
    consent_truth?: boolean; // novo
    consent_data?: boolean; // novo
  };
  selectedMinistries?: unknown; // pode vir string[] | number[]
  selectedCell?: unknown; // pode vir string | number | null
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

function cleanStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function normalizeId(v: unknown): string | number | null {
  // Aceita "123", 123, UUID, etc. Se vier vazio, null.
  if (v === null || v === undefined) return null;

  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    // Se for número em string, mantém como número (melhor para colunas int)
    if (/^\d+$/.test(t)) return Number(t);
    return t; // uuid ou texto
  }

  return null;
}

function normalizeIdArray(v: unknown): Array<string | number> {
  if (!Array.isArray(v)) return [];
  const out: Array<string | number> = [];
  for (const item of v) {
    const id = normalizeId(item);
    if (id !== null) out.push(id);
  }
  // remove duplicados
  return Array.from(new Set(out));
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

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

    // ===== validações mínimas =====
    const name = (f.name || "").trim();
    if (name.length < 3) return json(400, { ok: false, error: "Nome inválido" });

    const phoneDigits = normalizePhone(f.phone);
    if (!phoneDigits || phoneDigits.length < 10) {
      return json(400, { ok: false, error: "Telefone inválido" });
    }

    if (!f.birth_date) return json(400, { ok: false, error: "Nascimento obrigatório" });

    const zone = (f.zone || "").trim();
    if (!zone) return json(400, { ok: false, error: "Zona obrigatória" });

    if (typeof f.baptized !== "boolean") return json(400, { ok: false, error: "Batismo inválido" });
    if (f.baptized === false && typeof f.baptism_contact !== "boolean") {
      return json(400, { ok: false, error: "Interesse no batismo obrigatório" });
    }

    if (f.wants_visit && !f.address_opt_in) {
      return json(400, { ok: false, error: "Visita requer endereço" });
    }

    // Se marcou endereço, valida o básico
    if (f.address_opt_in) {
      const street = cleanStr(f.street);
      const house_number = cleanStr(f.house_number);
      const neighborhood = cleanStr(f.neighborhood);
      const city = cleanStr(f.city);

      if (!street) return json(400, { ok: false, error: "Informe a rua" });
      if (!house_number) return json(400, { ok: false, error: "Informe o número" });
      if (!neighborhood) return json(400, { ok: false, error: "Informe o bairro" });
      if (!city) return json(400, { ok: false, error: "Informe a cidade" });
    }

    // Checkboxes: aceita padrão antigo OU novo
    const declaration_true = (f.declaration_true === true) || (f.consent_truth === true);
    const consent_internal = (f.consent_internal === true) || (f.consent_data === true);

    if (!declaration_true || !consent_internal) {
      return json(400, { ok: false, error: "Confirmações obrigatórias" });
    }

    // Normaliza ids vindos do front
    const ministryIds = normalizeIdArray(payload.selectedMinistries);
    const selectedCell = normalizeId(payload.selectedCell);

    // ===== 1) Insere pessoa =====
    const insertPerson = {
      name,
      phone: phoneDigits,
      birth_date: f.birth_date,

      baptized: f.baptized,
      baptism_contact: f.baptized ? null : f.baptism_contact,

      zone,

      address_opt_in: !!f.address_opt_in,
      wants_visit: f.address_opt_in ? !!f.wants_visit : false,

      street: f.address_opt_in ? cleanStr(f.street) : null,
      house_number: f.address_opt_in ? cleanStr(f.house_number) : null,
      complement: f.address_opt_in ? cleanStr(f.complement) : null,
      neighborhood: f.address_opt_in ? cleanStr(f.neighborhood) : null,
      city: f.address_opt_in ? cleanStr(f.city) : null,
      reference: f.address_opt_in ? cleanStr(f.reference) : null,

      wants_ministry: !!f.wants_ministry,
      wants_cell: !!f.wants_cell,

      declaration_true,
      consent_internal,
    };

    const { data: person, error: personErr } = await sb
      .from("people")
      .insert(insertPerson)
      .select("id")
      .single();

    if (personErr) {
      return json(500, { ok: false, error: "Insert people failed", detail: personErr.message });
    }

    const person_id = person.id as string;

    // Helper de rollback: se algo der ruim depois, apaga a pessoa criada
    async function rollbackPerson() {
      try {
        await sb.from("people").delete().eq("id", person_id);
      } catch {
        // silêncio mesmo
      }
    }

    // ===== 2) Ministérios =====
    if (ministryIds.length > 0) {
      const rows = ministryIds.map((ministry_id) => ({ person_id, ministry_id }));
      const { error: pmErr } = await sb.from("people_ministries").insert(rows);
      if (pmErr) {
        await rollbackPerson();
        return json(500, { ok: false, error: "Insert people_ministries failed", detail: pmErr.message });
      }
    }

    // ===== 3) Célula =====
    if (selectedCell !== null) {
      const { error: pcErr } = await sb.from("people_cells").insert({
        person_id,
        cell_id: selectedCell,
      });
      if (pcErr) {
        await rollbackPerson();
        return json(500, { ok: false, error: "Insert people_cells failed", detail: pcErr.message });
      }
    }

    return json(200, { ok: true, id: person_id });
  } catch (e) {
    return json(500, { ok: false, error: "Unhandled", detail: String((e as any)?.message ?? e) });
  }
});

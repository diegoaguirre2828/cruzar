// Alert engine — evaluates operator_alert_rules against the current ETA
// snapshot of a tracked load and produces a dispatch payload when a rule
// fires.
//
// Pure logic; the cron job (/api/cron/dispatch-alerts) is responsible for
// reading rules + loads from the DB, calling evaluateRule, and writing
// the dispatch row + delivering via the chosen channel.

import type { computeLoadEta } from "@/lib/loadEta";

type EtaResult = Awaited<ReturnType<typeof computeLoadEta>>;

export type TriggerKind =
  | "wait_threshold"
  | "p_make_appt_below"
  | "detention_dollars_above"
  | "anomaly_at_recommended"
  | "eta_slip_minutes";

export interface AlertRule {
  id: string;
  user_id: string;
  load_id: string | null;
  trigger_kind: TriggerKind;
  threshold_value: number;
  channel: "push" | "sms" | "email" | "mcp_log";
  active: boolean;
  cooldown_minutes: number;
  last_fired_at: string | null;
}

export interface LoadSnapshot {
  id: string;
  load_ref: string;
  recommended_port_id: string | null;
  predicted_wait_minutes: number | null;
  predicted_eta_minutes: number | null;
  predicted_arrival_at: string | null;
  p_make_appointment: number | null;
  detention_risk_dollars: number | null;
  eta_refreshed_at: string | null;
}

export interface RuleEval {
  fired: boolean;
  reason: string;
  payload: {
    load_ref: string;
    trigger_kind: TriggerKind;
    threshold: number;
    observed: number | null;
    port_id: string | null;
    predicted_arrival_at: string | null;
    p_make_appointment: number | null;
    detention_dollars: number | null;
  };
}

export function evaluateRule(
  rule: AlertRule,
  load: LoadSnapshot,
  currentEta: EtaResult | null,
  priorEtaMinutes: number | null,
  anomalyAtRecommended: boolean,
): RuleEval {
  const now = Date.now();
  const cooldownMs = rule.cooldown_minutes * 60 * 1000;
  if (rule.last_fired_at && now - new Date(rule.last_fired_at).getTime() < cooldownMs) {
    return mkEval(false, "in_cooldown", rule, load, null);
  }
  if (!rule.active) return mkEval(false, "inactive", rule, load, null);

  const thr = rule.threshold_value;
  const wait = currentEta?.recommended.predicted_wait_min ?? load.predicted_wait_minutes;
  const pma = currentEta?.recommended.p_make_appointment ?? load.p_make_appointment;
  const det = currentEta?.recommended.detention_dollars ?? load.detention_risk_dollars;
  const totalEta = currentEta?.recommended.total_eta_min ?? load.predicted_eta_minutes;

  switch (rule.trigger_kind) {
    case "wait_threshold":
      if (wait != null && wait > thr) return mkEval(true, `wait ${wait}min > ${thr}min`, rule, load, wait);
      return mkEval(false, "wait below threshold", rule, load, wait);
    case "p_make_appt_below":
      if (pma != null && pma < thr) return mkEval(true, `P(make appt) ${pma.toFixed(2)} < ${thr}`, rule, load, pma);
      return mkEval(false, "p_make_appt above threshold", rule, load, pma);
    case "detention_dollars_above":
      if (det != null && det > thr) return mkEval(true, `detention $${det} > $${thr}`, rule, load, det);
      return mkEval(false, "detention below threshold", rule, load, det);
    case "anomaly_at_recommended":
      if (anomalyAtRecommended) return mkEval(true, "recommended port is anomaly_high", rule, load, 1);
      return mkEval(false, "recommended port is normal", rule, load, 0);
    case "eta_slip_minutes":
      if (priorEtaMinutes != null && totalEta != null) {
        const slip = totalEta - priorEtaMinutes;
        if (slip > thr) return mkEval(true, `eta slipped +${slip}min vs prior`, rule, load, slip);
        return mkEval(false, `eta slip ${slip}min within threshold`, rule, load, slip);
      }
      return mkEval(false, "no prior eta to compare", rule, load, null);
  }
}

function mkEval(
  fired: boolean,
  reason: string,
  rule: AlertRule,
  load: LoadSnapshot,
  observed: number | null,
): RuleEval {
  return {
    fired,
    reason,
    payload: {
      load_ref: load.load_ref,
      trigger_kind: rule.trigger_kind,
      threshold: rule.threshold_value,
      observed,
      port_id: load.recommended_port_id,
      predicted_arrival_at: load.predicted_arrival_at,
      p_make_appointment: load.p_make_appointment,
      detention_dollars: load.detention_risk_dollars,
    },
  };
}

export function renderAlertText(rule: AlertRule, load: LoadSnapshot, ev: RuleEval): { en: string; es: string } {
  const ref = load.load_ref;
  const port = load.recommended_port_id ?? "unknown";
  const arr = load.predicted_arrival_at
    ? new Date(load.predicted_arrival_at).toISOString().slice(11, 16) + " UTC"
    : "—";
  const dollars = (n: number | null | undefined) => (n != null ? `$${Math.round(n)}` : "—");
  switch (rule.trigger_kind) {
    case "wait_threshold":
      return {
        en: `Cruzar — load ${ref}: predicted wait at ${port} now ${ev.payload.observed} min (rule: >${rule.threshold_value}). Predicted arrival ${arr}.`,
        es: `Cruzar — carga ${ref}: espera prevista en ${port} ${ev.payload.observed} min (regla: >${rule.threshold_value}). Llegada estimada ${arr}.`,
      };
    case "p_make_appt_below":
      return {
        en: `Cruzar — load ${ref}: P(make appt) ${ev.payload.observed} below ${rule.threshold_value}. Detention exposure ${dollars(load.detention_risk_dollars)}.`,
        es: `Cruzar — carga ${ref}: P(llegar a tiempo) ${ev.payload.observed} bajo ${rule.threshold_value}. Exposición a detention ${dollars(load.detention_risk_dollars)}.`,
      };
    case "detention_dollars_above":
      return {
        en: `Cruzar — load ${ref}: detention exposure ${dollars(ev.payload.observed)} above $${rule.threshold_value}. Reroute or warn dock.`,
        es: `Cruzar — carga ${ref}: exposición a detention ${dollars(ev.payload.observed)} sobre $${rule.threshold_value}. Reenruta o avisa al dock.`,
      };
    case "anomaly_at_recommended":
      return {
        en: `Cruzar — load ${ref}: ${port} is running anomalously high right now. Consider an alternate bridge.`,
        es: `Cruzar — carga ${ref}: ${port} tiene espera anómala en este momento. Considera otro puente.`,
      };
    case "eta_slip_minutes":
      return {
        en: `Cruzar — load ${ref}: ETA slipped +${ev.payload.observed} min vs last compute. Predicted arrival ${arr}.`,
        es: `Cruzar — carga ${ref}: ETA se atrasó +${ev.payload.observed} min vs último cálculo. Llegada estimada ${arr}.`,
      };
  }
}

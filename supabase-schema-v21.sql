-- v21: Clear stale Brownsville local name overrides
--
-- Earlier today I mislabeled 535501 B&M as "Puente Nuevo" in two places:
-- the static portMeta.ts AND via the admin Ports tab override. Diego
-- corrected: B&M is actually "Puente Viejo" and Gateway is "Puente Nuevo".
-- The static file is now fixed, but any admin overrides pointing to the
-- wrong name need to be wiped so the new static defaults take effect.

delete from port_overrides where port_id = '535501';
delete from port_overrides where port_id = '535504';

-- Re-running this is safe (deletes what isn't there = no-op).

-- Index for historical averages lookup in /api/ports
-- Without this, eq('hour_of_day', N) does a full table scan on
-- wait_time_readings, saturating the connection pool.
CREATE INDEX IF NOT EXISTS idx_wait_time_readings_hour_port
  ON wait_time_readings (hour_of_day, port_id);

CREATE INDEX IF NOT EXISTS idx_wait_time_readings_dow_hour_port
  ON wait_time_readings (day_of_week, hour_of_day, port_id);

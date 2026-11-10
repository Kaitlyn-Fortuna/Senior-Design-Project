DROP TABLE IF EXISTS powerdata;
DROP INDEX IF EXISTS powerdata_tStamp_idx;
DROP INDEX IF EXISTS powerdata_isConsolidated_idx;
DROP INDEX IF EXISTS powerdata_powerPrice_idx;
CREATE TABLE powerdata (
	-- Meta
	pKey 			bigint 		GENERATED ALWAYS AS IDENTITY	PRIMARY KEY,
	tStamp 			timestamp	DEFAULT CURRENT_TIMESTAMP,
	isConsolidated	boolean		DEFAULT false,
	powerPrice		money		DEFAULT 0.0,
	-- Currents
	i0				real		DEFAULT 0.0,
	i1				real		DEFAULT 0.0,
	i2				real		DEFAULT 0.0,
	i3				real		DEFAULT 0.0,
	i4				real		DEFAULT 0.0,
	i5				real		DEFAULT 0.0,
	-- Voltages
	v0				real		DEFAULT 0.0,
	v1				real		DEFAULT 0.0,
	v2				real		DEFAULT 0.0,
	v3				real		DEFAULT 0.0,
	v4				real		DEFAULT 0.0,
	v5				real		DEFAULT 0.0,
	-- Powers
	p0				real		DEFAULT 0.0,
	p1				real		DEFAULT 0.0,
	p2				real		DEFAULT 0.0,
	p3				real		DEFAULT 0.0,
	p4				real		DEFAULT 0.0,
	p5				real		DEFAULT 0.0,
	-- Power Factors
	pf0				real		DEFAULT 0.0,
	pf1				real		DEFAULT 0.0,
	pf2				real		DEFAULT 0.0,
	pf3				real		DEFAULT 0.0,
	pf4				real		DEFAULT 0.0,
	pf5				real		DEFAULT 0.0
);
CREATE INDEX powerdata_tStamp_idx ON powerdata (tStamp);
CREATE INDEX powerdata_isConsolidated_idx ON powerdata (isConsolidated);
CREATE INDEX powerdata_powerPrice_idx ON powerdata (powerPrice);
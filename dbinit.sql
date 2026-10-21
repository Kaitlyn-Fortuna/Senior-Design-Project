DROP TABLE IF EXISTS powerdata;
CREATE TABLE powerdata (
	pKey 			bigint 		GENERATED ALWAYS AS IDENTITY	PRIMARY KEY,
	tStamp 			timestamp	DEFAULT CURRENT_TIMESTAMP,
	isConsolidated	boolean		DEFAULT false,
	p0				real		DEFAULT 0.0,
	p1				real		DEFAULT 0.0,
	p2				real		DEFAULT 0.0,
	p3				real		DEFAULT 0.0,
	p4				real		DEFAULT 0.0,
	p5				real		DEFAULT 0.0
);

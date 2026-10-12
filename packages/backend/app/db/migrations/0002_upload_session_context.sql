-- Upload session context: the declared recording format and
-- acquisition system are stored with the session so finalisation
-- and validation can recover them (the core ERD keeps format on
-- recordings; this is upload-session bookkeeping).

ALTER TABLE upload_sessions
    ADD COLUMN declared_format text
        CHECK (declared_format IN ('fif', 'ctf', 'kit', 'bin', 'bids')),
    ADD COLUMN acquisition_system text
        CHECK (acquisition_system IN ('squid', 'opm'));

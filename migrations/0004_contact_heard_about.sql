-- Migration number: 0004 	 contact form: "how did you hear about me?"
--
-- Optional on the form, so both columns are nullable. `heard_about` is the
-- fixed option the visitor picked (the dashboard groups by it); the free-text
-- `heard_about_detail` is kept apart so "who referred you?" answers never
-- fragment that grouping into one bar per referrer.
ALTER TABLE contact_submissions ADD COLUMN heard_about TEXT;
ALTER TABLE contact_submissions ADD COLUMN heard_about_detail TEXT;

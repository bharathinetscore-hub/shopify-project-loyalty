ALTER TABLE "netst-lmp-users"
ADD COLUMN IF NOT EXISTS product_code VARCHAR(255);

ALTER TABLE "netst-lmp-users"
ADD COLUMN IF NOT EXISTS license_url VARCHAR(500);

ALTER TABLE "netst-lmp-users"
ALTER COLUMN username DROP NOT NULL,
ALTER COLUMN password DROP NOT NULL;

-- Sekar & Co — Employee Details Portal schema
-- Runs automatically on first Postgres container start (mounted into docker-entrypoint-initdb.d)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users (authentication)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    role          TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Employees (one record per submitted Employee Details Form)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_by             UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Section 1: Personal Information
    full_name                TEXT NOT NULL,
    date_of_birth            DATE,
    blood_group              TEXT,
    gender                   TEXT,
    marital_status           TEXT,
    personal_phone           TEXT,
    email                    TEXT,
    permanent_address        TEXT,
    photo_path               TEXT,

    -- Section 2: Employment & Joining Details
    designation              TEXT,
    division                 TEXT,
    joining_month_year       TEXT,
    reporting_to             TEXT,
    referenced_by            TEXT,
    reference_phone          TEXT,

    -- Section 3: Identity & Statutory Details
    pan_card_no              TEXT,
    aadhaar_card_no          TEXT,
    esi_applicable           BOOLEAN DEFAULT FALSE,
    esi_no                   TEXT,
    proof_1                  TEXT,
    proof_2                  TEXT,

    -- Section 4: Emergency Contact Information
    emergency_contact_person TEXT,
    emergency_relationship   TEXT,
    emergency_contact_no     TEXT,

    -- Section 5: Educational Qualifications
    highest_qualification    TEXT,
    college_name             TEXT,
    college_location         TEXT,
    school_name              TEXT,
    school_location          TEXT,

    -- Section 6: Previous Work Information
    prev_organization        TEXT,
    prev_position            TEXT,
    prev_salary              TEXT,
    prev_period_from         TEXT,
    prev_period_to           TEXT,
    prev_reason_for_leaving  TEXT,
    prev_contact_name        TEXT,
    prev_contact_position    TEXT,
    prev_contact_number      TEXT,

    -- Section 7: Medical Record
    medical_operations         BOOLEAN DEFAULT FALSE,
    medical_operations_detail  TEXT,
    medical_allergies          BOOLEAN DEFAULT FALSE,
    medical_allergies_detail   TEXT,
    medical_medication         BOOLEAN DEFAULT FALSE,
    medical_medication_detail  TEXT,
    medical_doctor             BOOLEAN DEFAULT FALSE,
    medical_doctor_detail      TEXT,

    -- Section 8: Declaration
    declaration_certificate  TEXT,
    declaration_place        TEXT,
    declaration_date         DATE,
    declaration_signature    TEXT,
    declaration_consent      BOOLEAN DEFAULT FALSE,

    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_full_name ON employees (lower(full_name));
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees (created_at DESC);

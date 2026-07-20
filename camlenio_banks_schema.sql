CREATE TABLE IF NOT EXISTS public.camlenio_banks (
    id SERIAL PRIMARY KEY,
    bank_id VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255),
    bank_code VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_camlenio_banks_code ON public.camlenio_banks(bank_code);

-- Function to find best matching bankProfileId based on IFSC
CREATE OR REPLACE FUNCTION public.get_camlenio_bank_profile_id(p_ifsc VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_bank_id VARCHAR;
BEGIN
    SELECT bank_id INTO v_bank_id
    FROM public.camlenio_banks
    WHERE p_ifsc LIKE bank_code || '%'
    ORDER BY LENGTH(bank_code) DESC
    LIMIT 1;

    RETURN v_bank_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
  # Update acessos table - Change data_pagamento to dia_pagamento

  1. Table Updates
    - Change data_pagamento column from date to integer (1-31)
    - Rename column to dia_pagamento for better clarity

  2. Data Migration
    - Convert existing date values to day numbers
    - Handle null values appropriately
*/

-- First, add the new column
ALTER TABLE acessos ADD COLUMN dia_pagamento integer CHECK (dia_pagamento >= 1 AND dia_pagamento <= 31);

-- Migrate existing data (extract day from date)
UPDATE acessos 
SET dia_pagamento = EXTRACT(DAY FROM data_pagamento)::integer 
WHERE data_pagamento IS NOT NULL;

-- Drop the old column
ALTER TABLE acessos DROP COLUMN data_pagamento;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_acessos_dia_pagamento ON acessos(dia_pagamento);
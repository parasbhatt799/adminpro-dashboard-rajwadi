const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const billers = [
  {
    biller_id: 'AIRT00000PRE',
    biller_name: 'Airtel Prepaid',
    category: 'Mobile Prepaid',
    metadata: {
      billerId: 'AIRT00000PRE',
      billerName: 'Airtel Prepaid',
      category: 'Mobile Prepaid',
      inputParams: {
        input: [
          { paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'JIO000000PRE',
    biller_name: 'Jio Prepaid',
    category: 'Mobile Prepaid',
    metadata: {
      billerId: 'JIO000000PRE',
      billerName: 'Jio Prepaid',
      category: 'Mobile Prepaid',
      inputParams: {
        input: [
          { paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'SBIC000000CC',
    biller_name: 'SBI Card',
    category: 'Credit Card',
    metadata: {
      billerId: 'SBIC000000CC',
      billerName: 'SBI Card',
      category: 'Credit Card',
      inputParams: {
        input: [
          { paramName: 'Card Number', dataType: 'NUMERIC', optional: 'false' },
          { paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'TORR00000ELE',
    biller_name: 'Torrent Power',
    category: 'Electricity',
    metadata: {
      billerId: 'TORR00000ELE',
      billerName: 'Torrent Power',
      category: 'Electricity',
      inputParams: {
        input: [
          { paramName: 'Service Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'ADAN00000GAS',
    biller_name: 'Adani Gas',
    category: 'Gas',
    metadata: {
      billerId: 'ADAN00000GAS',
      billerName: 'Adani Gas',
      category: 'Gas',
      inputParams: {
        input: [
          { paramName: 'Customer ID', dataType: 'ALPHANUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'AMCW00000WAT',
    biller_name: 'Ahmedabad Municipal Corporation',
    category: 'Water',
    metadata: {
      billerId: 'AMCW00000WAT',
      billerName: 'Ahmedabad Municipal Corporation',
      category: 'Water',
      inputParams: {
        input: [
          { paramName: 'Tenement Number', dataType: 'ALPHANUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'JIOF00000BRO',
    biller_name: 'JioFiber',
    category: 'Broadband',
    metadata: {
      billerId: 'JIOF00000BRO',
      billerName: 'JioFiber',
      category: 'Broadband',
      inputParams: {
        input: [
          { paramName: 'Fixed Line Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'BAJA00000LOA',
    biller_name: 'Bajaj Finance',
    category: 'Loan Repayment',
    metadata: {
      billerId: 'BAJA00000LOA',
      billerName: 'Bajaj Finance',
      category: 'Loan Repayment',
      inputParams: {
        input: [
          { paramName: 'Loan Account Number', dataType: 'ALPHANUMERIC', optional: 'false' }
        ]
      }
    }
  }
];

async function main() {
  console.log('Seeding staging billers to database...');
  const { data, error } = await supabase
    .from('billavenue_billers')
    .upsert(billers);

  if (error) {
    console.error('Error seeding database:', error.message);
  } else {
    console.log('Successfully seeded 8 staging billers!');
  }
}

main();
